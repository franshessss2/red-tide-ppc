import { GitHubCalendar } from "@/components/ui/git-hub-calendar";

export default function DemoOne() {
  const contributionData = (() => {
    const out: { date: string; count: number }[] = [];
    const today = new Date();
    for (let i = 364; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      const weekend = day.getDay() === 0 || day.getDay() === 6;
      const season = 0.55 + 0.45 * Math.sin(i / 34);
      const r = Math.sin(i * 12.9898) * 43758.5453;
      const noise = r - Math.floor(r);
      const v = noise * (weekend ? 0.35 : 1) * season * 5.6;
      out.push({
        date: day.toISOString().slice(0, 10),
        count: v < 1.1 ? 0 : Math.min(5, Math.round(v)),
      });
    }
    return out;
  })();

  return (
    <div> 
      <GitHubCalendar 
      data={contributionData}  
      />
    </div>
  );
}