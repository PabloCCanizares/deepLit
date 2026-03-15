import '../../styles/dashboard/ActivityCalendar.css'

const WEEKDAY_HEADER = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function buildCalendarData() {
  const year = new Date().getFullYear()

  const months = Array.from({ length: 12 }, (_, month) => {
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const monthStartWeekday = (firstDay.getDay() + 6) % 7

    const cells = []

    for (let i = 0; i < monthStartWeekday; i += 1) {
      cells.push({
        date: null,
        level: 0,
        isFiller: true,
      })
    }

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum += 1) {
      const date = new Date(year, month, dayNum)
      const seed = (dayNum * 17 + (month + 1) * 13 + date.getDay() * 3) % 5
      cells.push({
        date,
        level: seed,
        isFiller: false,
      })
    }

    while (cells.length % 7 !== 0) {
      cells.push({
        date: null,
        level: 0,
        isFiller: true,
      })
    }

    return {
      month,
      label: MONTH_LABELS[month],
      cells,
    }
  })

  return { months, year }
}

function ActivityCalendar() {
  const { months, year } = buildCalendarData()

  return (
    <div className="activityCalendarWrapper">
      <p className="activityCalendarYear">{year}</p>

      <div className="activityMonthsGrid" role="img" aria-label="Calendario de actividad del usuario por mes">
        {months.map((monthData) => (
          <div className="activityMonthCard" key={monthData.month}>
            <h4 className="activityMonthTitle">{monthData.label}</h4>

            <div className="activityWeekHeader">
              {WEEKDAY_HEADER.map((day) => (
                <span key={`${monthData.month}-${day}`}>{day}</span>
              ))}
            </div>

            <div className="activityMonthCells">
              {monthData.cells.map((day, index) => (
                <span
                  key={`${monthData.month}-${index}`}
                  className={`activityCell ${day.isFiller ? 'outside-year' : `level-${day.level}`}`}
                  title={day.date ? `${day.date.toLocaleDateString('es-ES')} - actividad nivel ${day.level}` : ''}
                >
                  {day.date ? day.date.getDate() : ''}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="activityLegend">
        <span>Menos</span>
        <span className="activityCell level-0" />
        <span className="activityCell level-1" />
        <span className="activityCell level-2" />
        <span className="activityCell level-3" />
        <span className="activityCell level-4" />
        <span>Más</span>
      </div>
    </div>
  )
}

export default ActivityCalendar
