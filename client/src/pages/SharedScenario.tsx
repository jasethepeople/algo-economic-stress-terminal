import { trpc } from "@/lib/trpc";
import { Activity, Loader2, LockKeyhole, ShieldAlert } from "lucide-react";
import { useRoute } from "wouter";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function SharedScenario() {
  const [, params] = useRoute("/share/:token");
  const query = trpc.scenarios.shared.useQuery({ token: params?.token ?? "missing-token" }, { retry: false });
  if (query.isLoading) return <div className="shared-page"><Loader2 className="animate-spin text-cyan-300" /><span>Loading read-only scenario</span></div>;
  if (!query.data) return <div className="shared-page"><LockKeyhole size={28} className="text-amber-300" /><strong>Scenario unavailable</strong><span>This read-only share link may have been revoked.</span></div>;
  const { snapshot, name, tags } = query.data;
  return <main className="shared-page"><div className="shared-card"><header><div className="brand-mark"><Activity size={17} /></div><div><span>APEX MS / READ-ONLY SCENARIO</span><h1>{name}</h1>{tags?.length ? <p>{tags.join(" · ")}</p> : null}</div></header><div className="shared-metrics"><div><span>MARK</span><b>${snapshot.price.toFixed(3)}</b></div><div><span>RISK SCORE</span><b>{snapshot.risk.riskScore.toFixed(1)} / 100</b></div><div><span>COLLAPSE PROB.</span><b>{pct(snapshot.risk.collapseProbability)}</b></div><div><span>LIQUIDITY</span><b>{pct(snapshot.risk.liquidityHealth)}</b></div></div><section><ShieldAlert size={15} /><span>This is a read-only, synthetic stress-test snapshot. It does not expose private schedules, reports, or editing controls.</span></section></div></main>;
}
