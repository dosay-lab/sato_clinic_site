$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$chrome = Start-Process -FilePath 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList @('--headless','--disable-gpu','--no-first-run','--allow-file-access-from-files','--remote-debugging-port=9237',"--user-data-dir=$root\.chrome-calendar-check",'about:blank') -WindowStyle Hidden -PassThru
$socket = New-Object Net.WebSockets.ClientWebSocket
try {
  for ($i=0; $i -lt 30; $i++) {
    try { $tabs = Invoke-RestMethod http://127.0.0.1:9237/json/list; break } catch { Start-Sleep -Milliseconds 200 }
  }
  $tab = $tabs | Where-Object type -eq 'page' | Select-Object -First 1
  [void]$socket.ConnectAsync([Uri]$tab.webSocketDebuggerUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
  $script:messageId = 0
  function Send-Cdp($method,$parameters) {
    $script:messageId++
    $payload = @{id=$script:messageId;method=$method;params=$parameters} | ConvertTo-Json -Depth 20 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    [void]$socket.SendAsync([ArraySegment[byte]]::new($bytes),[Net.WebSockets.WebSocketMessageType]::Text,$true,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
    do {
      $message = New-Object Text.StringBuilder
      do {
        $buffer = New-Object byte[] 65536
        $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer),[Threading.CancellationToken]::None).GetAwaiter().GetResult()
        [void]$message.Append([Text.Encoding]::UTF8.GetString($buffer,0,$received.Count))
      } until ($received.EndOfMessage)
      $response = $message.ToString() | ConvertFrom-Json
    } until ($response.id -eq $script:messageId)
    if ($response.error) { throw ($response.error | ConvertTo-Json) }
    return $response.result
  }
  function Evaluate($expression) {
    $result = Send-Cdp 'Runtime.evaluate' @{expression=$expression;awaitPromise=$true;returnByValue=$true}
    if ($result.exceptionDetails) { throw ($result.exceptionDetails | ConvertTo-Json -Depth 10) }
    return $result.result.value
  }
  $reports = @()
  foreach ($width in @(320,1440)) {
    [void](Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=$width;height=900;deviceScaleFactor=1;mobile=$false})
    [void](Send-Cdp 'Page.navigate' @{url='file:///C:/academia/src/sato_clinic_site/reservation.html'})
    Start-Sleep -Milliseconds 500
    [void](Evaluate "new Promise(resolve=>{const poll=setInterval(()=>{if(document.querySelector('.calendar-day')){clearInterval(poll);resolve(true)}},50)})")
    $logic = Evaluate @"
(() => {
 const errors=[],check=(ok,msg)=>{if(!ok)errors.push(msg)};
 const c=document.querySelector('.calendar'),next=c.querySelector('.calendar-next'),grid=c.querySelector('.calendar-grid');
 for(let i=0;i<30;i++){
  const expected=new Date(2026,8+i,1),year=expected.getFullYear(),month=expected.getMonth();
  check(c.querySelector('.calendar-year').textContent===String(year),'year '+i);
  check(c.querySelector('.calendar-month').textContent===(month+1)+'月','month '+i);
  const days=[...grid.querySelectorAll('.calendar-day')];
  check(days.length===new Date(year,month+1,0).getDate(),'day count '+i);
  check([...grid.children].indexOf(days[0])-7===expected.getDay(),'weekday alignment '+i);
  check(days[0].getAttribute('aria-label').startsWith(year+'年'+(month+1)+'月1日'),'date label '+i);
  if(i<29)next.click();
 }
 const days=grid.querySelectorAll('.calendar-day');
 days[4].click();check(days[4].getAttribute('aria-pressed')==='true','selection');
 check(getComputedStyle(days[4]).animationName==='calendar-day-pop','click animation');
 days[8].click();check(grid.querySelectorAll('[aria-pressed=true]').length===1,'single selection');
 check(days[4].getAttribute('aria-pressed')==='false','old selection cleared');
 days[8].click();check(days[8].classList.contains('is-clicked'),'repeat click');
 next.click();check(!grid.querySelector('[aria-pressed=true]'),'new month selection');
 check(document.documentElement.scrollWidth<=innerWidth,'overflow');
 next.focus();
 return {width:innerWidth,months:30,errors};
})()
"@
    $reports += $logic
    $before = Evaluate "document.querySelector('.calendar-month').textContent"
    [void](Send-Cdp 'Input.dispatchKeyEvent' @{type='keyDown';key='Enter';code='Enter';windowsVirtualKeyCode=13;nativeVirtualKeyCode=13;text=[string][char]13})
    [void](Send-Cdp 'Input.dispatchKeyEvent' @{type='keyUp';key='Enter';code='Enter';windowsVirtualKeyCode=13})
    $after = Evaluate "document.querySelector('.calendar-month').textContent"
    if ($before -eq $after) { throw ('Keyboard month navigation failed: ' + (Evaluate 'document.activeElement.outerHTML')) }
    [void](Evaluate "const c=document.querySelector('.calendar');window.scrollTo(0,c.getBoundingClientRect().top+scrollY-document.querySelector('header').offsetHeight-16)")
    Start-Sleep -Milliseconds 850
    $point = Evaluate "(()=>{const r=document.querySelector('.calendar-day').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()"
    [void](Send-Cdp 'Input.dispatchMouseEvent' @{type='mouseMoved';x=$point.x;y=$point.y})
    Start-Sleep -Milliseconds 250
    $hover = Evaluate "(()=>{const d=document.querySelector('.calendar-day'),s=getComputedStyle(d);return {hover:d.matches(':hover'),transform:s.transform}})()"
    if (!$hover.hover -or $hover.transform -eq 'none') { throw 'Hover animation failed' }
    [void](Send-Cdp 'Input.dispatchMouseEvent' @{type='mousePressed';x=$point.x;y=$point.y;button='left';clickCount=1})
    [void](Send-Cdp 'Input.dispatchMouseEvent' @{type='mouseReleased';x=$point.x;y=$point.y;button='left';clickCount=1})
    $selected = Evaluate "document.querySelector('.calendar-day').getAttribute('aria-pressed')"
    if ($selected -ne 'true') { throw 'Pointer selection failed' }
  }
  [void](Send-Cdp 'Emulation.setEmulatedMedia' @{features=@(@{name='prefers-reduced-motion';value='reduce'})})
  $motion = Evaluate "(()=>{const d=document.querySelector('.calendar-day');d.click();const s=getComputedStyle(d);return {animation:s.animationName,transform:s.transform,transition:s.transitionDuration}})()"
  if ($motion.animation -ne 'none' -or $motion.transform -ne 'none' -or $motion.transition -ne '0s') { throw 'Reduced motion failed' }
  @{layouts=$reports;pointerAndKeyboard='passed';reducedMotion='passed'} | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 .calendar-results.json
} finally {
  $socket.Dispose()
  if (!$chrome.HasExited) { Stop-Process -Id $chrome.Id }
}