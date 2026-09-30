(() => {
  const calendar = document.querySelector('.calendar');
  if (!calendar) return;

  const grid = calendar.querySelector('.calendar-grid');
  const monthLabel = calendar.querySelector('.calendar-month');
  const yearLabel = calendar.querySelector('.calendar-year');
  const prev = calendar.querySelector('.calendar-prev');
  const next = calendar.querySelector('.calendar-next');
  const todayButton = calendar.querySelector('.calendar-today');
  const choices = document.querySelectorAll('.reserve-choice input[type="radio"]');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const [initialYear, initialMonth] = calendar.dataset.month.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let year = initialYear;
  let month = initialMonth - 1;
  let selectedDate = null;
  let calendarEnabled = Array.from(choices).some(choice => choice.checked);
  let dialogBackdrop = null;
  let dialogReturnFocus = null;
  let selectedTime = null;

  function syncCalendarAvailability() {
    calendarEnabled = Array.from(choices).some(choice => choice.checked);
    calendar.classList.toggle('is-disabled', !calendarEnabled);
    calendar.setAttribute('aria-disabled', String(!calendarEnabled));
    prev.disabled = !calendarEnabled;
    next.disabled = !calendarEnabled;
    todayButton.disabled = !calendarEnabled;
    grid.querySelectorAll('.calendar-day').forEach(day => {
      day.disabled = !calendarEnabled || day.dataset.past === 'true';
    });
  }

  function render() {
    monthLabel.textContent = `${month + 1}月`;
    yearLabel.textContent = year;
    calendar.setAttribute('aria-label', `${year}年${month + 1}月のカレンダー`);
    const fragment = document.createDocumentFragment();

    weekdays.forEach((weekday, index) => {
      const label = document.createElement('div');
      label.className = `dow${index === 0 ? ' sun' : index === 6 ? ' sat' : ''}`;
      label.textContent = weekday;
      fragment.append(label);
    });

    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstWeekday; i++) {
      const blank = document.createElement('div');
      blank.setAttribute('aria-hidden', 'true');
      fragment.append(blank);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const weekday = (firstWeekday + day - 1) % 7;
      const date = new Date(year, month, day);
      const isPast = date < today;
      const button = document.createElement('button');
      button.type = 'button';
      button.disabled = !calendarEnabled || isPast;
      button.className = `calendar-day${weekday === 0 ? ' sun' : weekday === 6 ? ' sat' : ''}${isPast ? ' is-past' : ''}`;
      button.textContent = day;
      button.dataset.date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      button.dataset.past = String(isPast);
      button.setAttribute('aria-label', `${year}年${month + 1}月${day}日（${weekdays[weekday]}曜日）`);
      button.setAttribute('aria-pressed', String(selectedDate === button.dataset.date));
      fragment.append(button);
    }
    grid.replaceChildren(fragment);
  }

  function getVisitType() {
    return document.querySelector('[value="first"]')?.checked ? 'first' : 'return';
  }

  function formatSelectedDate(dateString) {
    const [dateYear, dateMonth, dateDay] = dateString.split('-').map(Number);
    const weekday = weekdays[new Date(dateYear, dateMonth - 1, dateDay).getDay()];
    return `${dateYear}年${dateMonth}月${dateDay}日（${weekday}曜日）`;
  }

  function isClosedTime(dateString, minutes) {
    const [dateYear, dateMonth, dateDay] = dateString.split('-').map(Number);
    const weekday = new Date(dateYear, dateMonth - 1, dateDay).getDay();
    if (weekday === 0 || weekday === 4) return true;
    if (minutes >= 11 * 60 + 15 && minutes <= 11 * 60 + 45) return true;
    if (weekday === 6 && minutes >= 11 * 60 + 15 && minutes <= 17 * 60) return true;
    return false;
  }

  // Keep the sample availability stable when the same date is opened again.
  function hasAvailability(dateString, minutes) {
    const value = `${dateString}-${minutes}`;
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 100 < 58;
  }

  function createTimeSlots(dateString) {
    const slots = [];
    for (let minutes = 8 * 60; minutes <= 17 * 60; minutes += 15) {
      const hour = Math.floor(minutes / 60);
      const minute = String(minutes % 60).padStart(2, '0');
      const time = `${hour}:${minute}`;
      const closed = isClosedTime(dateString, minutes);
      const available = !closed && hasAvailability(dateString, minutes);
      const status = closed ? '-' : available ? '〇' : '×';
      const stateClass = closed ? 'is-closed' : available ? 'is-available' : 'is-unavailable';
      const label = closed ? '休診' : available ? '空きあり' : '空きなし';
      slots.push(`<button class="booking-time-button ${stateClass}" type="button" data-time="${time}" aria-label="${time} ${label}" aria-pressed="false"${available ? '' : ' disabled'}><span>${time}</span><strong aria-hidden="true">${status}</strong></button>`);
    }
    return slots.join('');
  }

  function createPatientFields(visitType) {
    if (visitType === 'return') {
      return `
        <div class="booking-fields booking-fields--return">
          <label><span>患者番号 <em>必須</em></span><input type="text" name="patient-number" inputmode="numeric" autocomplete="off" required></label>
          <label><span>パスワード <em>必須</em></span><input type="password" name="password" autocomplete="current-password" required></label>
        </div>`;
    }
    return `
      <div class="booking-fields">
        <label><span>氏名 <em>必須</em></span><input type="text" name="name" autocomplete="name" required></label>
        <label><span>フリガナ <em>必須</em></span><input type="text" name="name-kana" autocomplete="off" required></label>
        <label><span>生年月日 <em>必須</em></span><input type="date" name="birth-date" autocomplete="bday" required></label>
        <label><span>性別 <em>必須</em></span><select name="gender" required><option value="">選択してください</option><option value="female">女性</option><option value="male">男性</option><option value="other">その他</option><option value="no-answer">回答しない</option></select></label>
        <label><span>電話番号 <em>必須</em></span><input type="tel" name="tel" autocomplete="tel" required></label>
        <label><span>Emailアドレス</span><input type="email" name="email" autocomplete="email"></label>
      </div>`;
  }

  function handleDialogKeydown(event) {
    if (event.key === 'Escape') closeDialog();
  }

  function closeDialog(restoreFocus = true) {
    if (!dialogBackdrop) return;
    dialogBackdrop.remove();
    dialogBackdrop = null;
    document.body.classList.remove('has-booking-dialog');
    document.removeEventListener('keydown', handleDialogKeydown);
    if (restoreFocus && dialogReturnFocus instanceof HTMLElement) dialogReturnFocus.focus();
  }

  function showCompletionDialog() {
    if (!dialogBackdrop) return;
    dialogBackdrop.innerHTML = `
      <section class="booking-dialog booking-dialog--complete" role="dialog" aria-modal="true" aria-labelledby="booking-complete-title">
        <button class="booking-dialog-close" type="button" aria-label="ダイアログを閉じる">×</button>
        <h2 id="booking-complete-title">予約が完了しました。</h2>
        <p>ご予約ありがとうございます。</p>
      </section>`;
    dialogBackdrop.querySelector('.booking-dialog-close').focus();
  }

  function openBookingDialog(dateString) {
    closeDialog(false);
    selectedTime = null;
    dialogReturnFocus = document.activeElement;
    const visitType = getVisitType();
    const visitLabel = visitType === 'first' ? '初診' : '再診';
    dialogBackdrop = document.createElement('div');
    dialogBackdrop.className = 'booking-dialog-backdrop';
    dialogBackdrop.innerHTML = `
      <section class="booking-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-dialog-title">
        <button class="booking-dialog-close" type="button" aria-label="ダイアログを閉じる">×</button>
        <div class="booking-dialog-heading">
          <p>${visitLabel}のご予約</p>
          <h2 id="booking-dialog-title">${formatSelectedDate(dateString)}</h2>
        </div>
        <form class="booking-form" novalidate>
          <fieldset class="booking-schedule">
            <legend>ご希望の時間を選択してください</legend>
            <div class="booking-legend" aria-label="予約状況の凡例"><span>〇：空きあり</span><span>×：空きなし</span><span>-：休診</span></div>
            <div class="booking-time-grid">${createTimeSlots(dateString)}</div>
            <p class="booking-time-selection" aria-live="polite">時間が選択されていません</p>
            <p class="booking-form-error" aria-live="assertive"></p>
          </fieldset>
          ${createPatientFields(visitType)}
          <p class="booking-submit-wrap"><button class="booking-submit blue-button" type="submit">送信</button></p>
        </form>
      </section>`;

    document.body.append(dialogBackdrop);
    document.body.classList.add('has-booking-dialog');
    document.addEventListener('keydown', handleDialogKeydown);

    dialogBackdrop.addEventListener('click', event => {
      if (event.target === dialogBackdrop || event.target.closest('.booking-dialog-close')) {
        closeDialog();
        return;
      }
      const timeButton = event.target.closest('.booking-time-button.is-available');
      if (!timeButton) return;
      selectedTime = timeButton.dataset.time;
      dialogBackdrop.querySelectorAll('.booking-time-button.is-available').forEach(button => {
        const isSelected = button === timeButton;
        button.classList.toggle('is-selected', isSelected);
        button.setAttribute('aria-pressed', String(isSelected));
      });
      dialogBackdrop.querySelector('.booking-time-selection').textContent = `選択中：${formatSelectedDate(dateString)} ${selectedTime}`;
      dialogBackdrop.querySelector('.booking-form-error').textContent = '';
    });

    dialogBackdrop.querySelector('.booking-form').addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!selectedTime) {
        const error = form.querySelector('.booking-form-error');
        error.textContent = '空きありの時間を選択してください。';
        form.querySelector('.booking-time-button.is-available')?.focus();
        return;
      }
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      showCompletionDialog();
    });

    dialogBackdrop.querySelector('.booking-dialog-close').focus();
  }

  choices.forEach(choice => {
    choice.addEventListener('change', () => {
      syncCalendarAvailability();
    });
  });

  prev.addEventListener('click', () => {
    month--;
    if (month === -1) {
      month = 11;
      year--;
    }
    render();
  });

  next.addEventListener('click', () => {
    month++;
    if (month === 12) {
      month = 0;
      year++;
    }
    render();
  });

  todayButton.addEventListener('click', () => {
    year = today.getFullYear();
    month = today.getMonth();
    render();
  });

  grid.addEventListener('click', event => {
    const button = event.target.closest('.calendar-day');
    if (!button) return;
    selectedDate = button.dataset.date;
    grid.querySelectorAll('.calendar-day').forEach(day => {
      day.setAttribute('aria-pressed', String(day === button));
      day.classList.remove('is-clicked');
    });
    // Restart the feedback even when the same date is selected again.
    void button.offsetWidth;
    button.classList.add('is-clicked');
    openBookingDialog(selectedDate);
  });
  grid.addEventListener('animationend', event => event.target.classList.remove('is-clicked'));
  render();
  syncCalendarAvailability();
})();
