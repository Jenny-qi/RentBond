import type { DeadlineSet } from '@/features/leases/types';

export function DeadlineStrip({ deadlines }: { deadlines: DeadlineSet }) {
  const days = [
    { name: '租期结束', temp: 'UTC', value: deadlines.leaseEndAtUtc.slice(5, 10) },
    { name: '申索截止', temp: 'UTC', value: deadlines.claimDeadlineUtc.slice(5, 10) },
    { name: '回应截止', temp: 'UTC', value: deadlines.responseDeadlineUtc.slice(5, 10) },
    { name: '主处理截止', temp: 'UTC', value: deadlines.primaryDeadlineUtc.slice(5, 10) },
    { name: '备用截止', temp: 'UTC', value: deadlines.fallbackDeadlineUtc.slice(5, 10) },
    { name: '最终退出', temp: 'UTC', value: deadlines.hardEndAtUtc.slice(5, 10) },
  ];
  return (
    <section style={{ position: 'relative' }}>
      <p className="kicker">期限（当地 / UTC / 倒计时提示）· {deadlines.timingProfile}</p>
      <svg className="wave" viewBox="0 0 600 54" fill="none">
        <path d="M0 32 C 80 32, 90 44, 140 40 C 200 34, 240 12, 300 16 C 360 20, 390 38, 460 28 C 520 20, 560 30, 600 26" stroke="rgba(246,243,238,0.55)" strokeWidth="2" />
        <circle cx="300" cy="16" r="5" fill="#fff" />
        <line x1="300" y1="16" x2="300" y2="54" stroke="rgba(255,255,255,0.35)" strokeDasharray="3 4" />
      </svg>
      <div className="week">
        {days.map((d) => (
          <div className="day" key={d.name}>
            {d.name}
            <strong>{d.value}</strong>
            <span className="help">{d.temp}</span>
          </div>
        ))}
      </div>
      <p className="help">{deadlines.countdownHint}。是否可执行以链上模拟为准，前端时钟不能放行资金。</p>
      <p className="help">当地 {deadlines.leaseEndAtLocal} · UTC {deadlines.leaseEndAtUtc} · 最迟 hardEndAt {deadlines.hardEndAtUtc}</p>
    </section>
  );
}
