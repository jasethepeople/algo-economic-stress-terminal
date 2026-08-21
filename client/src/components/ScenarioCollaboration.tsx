import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { buildScenarioComparison, type ComparisonRow } from "../../../shared/scenarioComparison";
import { Copy, FileClock, GitCompareArrows, Link2, Pause, Play, RefreshCw, Share2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const formatValue = (value: number, format: ComparisonRow["format"]) => {
  if (format === "currency") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  if (format === "milliseconds") return `${value}ms`;
  if (format === "integer") return Math.round(value).toString();
  return value.toFixed(2);
};

export function ScenarioCollaboration() {
  const { isAuthenticated } = useAuth();
  const scenariosQuery = trpc.scenarios.list.useQuery(undefined, { enabled: isAuthenticated });
  const inboxQuery = trpc.reports.inbox.useQuery(undefined, { enabled: isAuthenticated });
  const schedulesQuery = trpc.reports.schedules.useQuery(undefined, { enabled: isAuthenticated });
  const shareMutation = trpc.scenarios.share.useMutation();
  const revokeMutation = trpc.scenarios.revokeShare.useMutation();
  const generateMutation = trpc.reports.generateNow.useMutation();
  const createScheduleMutation = trpc.reports.createSchedule.useMutation();
  const toggleScheduleMutation = trpc.reports.setScheduleEnabled.useMutation();
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get("collab") === "1");
  const [firstId, setFirstId] = useState<number | undefined>();
  const [secondId, setSecondId] = useState<number | undefined>();
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const scenarios = scenariosQuery.data ?? [];
  useEffect(() => { if (!firstId && scenarios[0]) setFirstId(scenarios[0].id); if (!secondId && scenarios[1]) setSecondId(scenarios[1].id); }, [scenarios, firstId, secondId]);
  const compared = useMemo(() => [scenarios.find(item => item.id === firstId), scenarios.find(item => item.id === secondId)] as const, [scenarios, firstId, secondId]);
  const comparison = useMemo(() => compared[0] && compared[1] ? buildScenarioComparison(compared[0].snapshot, compared[1].snapshot) : null, [compared]);
  const createShare = (id: number) => shareMutation.mutate({ id }, { onSuccess: async data => { const url = `${window.location.origin}/share/${data.token}`; try { await navigator.clipboard.writeText(url); toast.success("Read-only share link copied"); } catch { toast.success(`Share link: ${url}`); } scenariosQuery.refetch(); }, onError: () => toast.error("The share link could not be created") });
  const activateSchedule = () => { if (window.location.hostname.includes("manus.computer")) { toast.info("Publish this checkpoint before activating schedules."); return; } createScheduleMutation.mutate({ cadence }, { onSuccess: () => { toast.success("Private report schedule activated"); schedulesQuery.refetch(); }, onError: error => toast.error(error.message) }); };

  return <div className="collab-dock"><button className="collab-launch" onClick={() => setOpen(value => !value)}><Share2 size={14} /> COLLABORATE</button>{open && <section className="collab-panel"><header><div><span className="eyebrow">PRIVATE WORKSPACE</span><strong>SCENARIOS & REPORTS</strong></div><button onClick={() => setOpen(false)}><X size={15} /></button></header>{!isAuthenticated ? <p className="collab-empty">Sign in to manage scenario links, comparisons, and your scheduled report inbox.</p> : <><section><div className="collab-title"><Link2 size={13} /> READ-ONLY SHARE LINKS</div>{scenarios.slice(0, 4).map(scenario => <div className="collab-row" key={scenario.id}><span><b>{scenario.name}</b><small>{scenario.shareEnabled ? "Share link active" : "Private"}</small></span>{scenario.shareEnabled ? <button onClick={() => revokeMutation.mutate({ id: scenario.id }, { onSuccess: () => { toast.success("Share link revoked"); scenariosQuery.refetch(); } })}>REVOKE</button> : <button onClick={() => createShare(scenario.id)}><Copy size={11} /> COPY LINK</button>}</div>)}{scenarios.length === 0 && <p className="collab-empty">Save a private scenario to create a share link.</p>}</section><section><div className="collab-title"><GitCompareArrows size={13} /> SIDE-BY-SIDE COMPARISON</div><div className="compare-selects"><select value={firstId ?? ""} onChange={event => setFirstId(Number(event.target.value))}>{scenarios.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select><select value={secondId ?? ""} onChange={event => setSecondId(Number(event.target.value))}>{scenarios.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select></div>{comparison && <><div className="compare-grid">{comparison.metrics.map(row => <div key={row.label}><span>{row.label}</span><b>{formatValue(row.left, row.format)}</b><b>{formatValue(row.right, row.format)}</b></div>)}</div><div className="parameter-deltas"><span>PARAMETER DELTAS / RIGHT − LEFT</span>{comparison.parameters.map(row => <div key={row.label}><b>{row.label}</b><small>{formatValue(row.left, row.format)} → {formatValue(row.right, row.format)}</small><em className={row.delta === 0 ? "" : row.delta > 0 ? "positive" : "negative"}>{row.delta === 0 ? "unchanged" : `${row.delta > 0 ? "+" : ""}${formatValue(row.delta, row.format)}`}</em></div>)}</div></>}</section><section><div className="collab-title"><FileClock size={13} /> PRIVATE REPORT INBOX</div><div className="report-controls"><button onClick={() => generateMutation.mutate(undefined, { onSuccess: () => { toast.success("Risk snapshot added to your inbox"); inboxQuery.refetch(); } })}><RefreshCw size={12} /> CAPTURE NOW</button><select value={cadence} onChange={event => setCadence(event.target.value as "daily" | "weekly")}><option value="daily">Daily · 09:00 UTC</option><option value="weekly">Weekly · Mon 09:00 UTC</option></select><button onClick={activateSchedule}><Play size={12} /> ACTIVATE</button></div>{(schedulesQuery.data ?? []).map(schedule => <div className="collab-row" key={schedule.id}><span><b>{schedule.cadence === "daily" ? "Daily" : "Weekly"} report</b><small>{schedule.enabled ? "Active" : "Paused"}</small></span><button onClick={() => toggleScheduleMutation.mutate({ id: schedule.id, enabled: !schedule.enabled }, { onSuccess: () => schedulesQuery.refetch() })}>{schedule.enabled ? <Pause size={11} /> : <Play size={11} />}{schedule.enabled ? " PAUSE" : " RESUME"}</button></div>)}{(inboxQuery.data ?? []).slice(0, 3).map(report => <div className="inbox-item" key={report.id}><span>{report.title}</span><small>{new Date(report.createdAt).toLocaleString()}</small></div>)}{(inboxQuery.data ?? []).length === 0 && <p className="collab-empty">Captured and scheduled reports appear here.</p>}<p className="collab-note">Schedules activate only after you publish this version. Report delivery stays inside your private terminal inbox.</p></section></>}</section>}</div>;
}
