import { KPICard } from "@/components/sis/kpi-card";

export default function SISPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">SIS Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <KPICard title="Total Students" value={1248} />
        <KPICard title="Active Batches" value={12} />
        <KPICard title="Pending Admissions" value={37} />
        <KPICard title="Attendance Today" value="93%" />
      </div>
    </div>
  );
}
