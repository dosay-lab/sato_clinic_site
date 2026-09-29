(() => {
  const calendar = document.querySelector('.calendar');
  if (!calendar) return;

  const grid = calendar.querySelector('.calendar-grid');
  const monthLabel = calendar.querySelector('.calendar-month');
  const yearLabel = calendar.querySelector('.calendar-year');
  const next = calendar.querySelector('.calendar-next');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const [initialYear, initialMonth] = calendar.dataset.month.split('-').map(Number);
  let year = initialYear;
  let month = initialMonth - 1;
  let selectedDate = null;

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
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `calendar-day${weekday === 0 ? ' sun' : weekday === 6 ? ' sat' : ''}`;
      button.textContent = day;
      button.dataset.date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      button.setAttribute('aria-label', `${year}年${month + 1}月${day}日（${weekdays[weekday]}曜日）`);
      button.setAttribute('aria-pressed', String(selectedDate === button.dataset.date));
      fragment.append(button);
    }
    grid.replaceChildren(fragment);
  }

  next.addEventListener('click', () => {
    month++;
    if (month === 12) {
      month = 0;
      year++;
    }
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
  });
  grid.addEventListener('animationend', event => event.target.classList.remove('is-clicked'));
  render();
})();
