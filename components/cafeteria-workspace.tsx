"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Props = { canCatalog: boolean; canMenus: boolean; canEnrollments: boolean; canMeals: boolean; canReports: boolean };
type Data = { items: any[]; menus: any[]; enrollments: any[]; mealRecords: any[]; students: any[]; policy: any };

export function CafeteriaWorkspace(props: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/operations/cafeteria/workspace", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Unable to load Cafeteria.");
    setData(body);
  }, []);

  useEffect(() => { load().catch((value) => setError(value.message)); }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>, path: string, build: (form: FormData) => unknown, method = "POST") {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = event.currentTarget;
    try {
      const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(build(new FormData(form))) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Cafeteria action failed.");
      setNotice("Saved. No payment or health record was created.");
      form.reset();
      await load();
    } catch (value) { setError(value instanceof Error ? value.message : "Cafeteria action failed."); }
  }

  if (!data && !error) return <div className="card"><p>Loading Cafeteria foundation…</p></div>;
  const menuItems = data?.menus.flatMap((menu: any) => menu.items.filter((item: any) => item.available && item.item.available && item.item.status === "ACTIVE").map((item: any) => ({ menu, item }))) ?? [];

  return <div className="optional-operations-workspace">
    <div className="card optional-operations-boundary" role="note"><strong>DEFAULT-OFF software foundation.</strong><p>No wallet, payment card, fee posting, delivery provider or health-record workflow. Dietary notes are omitted pending separate health-data governance.</p></div>
    {error ? <div className="alert error" role="alert">{error}</div> : null}
    {notice ? <div className="alert success" role="status">{notice}</div> : null}
    <section className="card-grid optional-operations-summary" aria-label="Cafeteria summary">
      <article className="card"><span className="muted">Catalog items</span><strong>{data?.items.length ?? 0}</strong></article>
      <article className="card"><span className="muted">Daily menus</span><strong>{data?.menus.length ?? 0}</strong></article>
      <article className="card"><span className="muted">Current opt-ins</span><strong>{data?.enrollments.filter((row: any) => row.active).length ?? 0}</strong></article>
      <article className="card"><span className="muted">Money mutation</span><strong>Prohibited</strong></article>
    </section>
    <div className="card-grid optional-operations-forms">
      {props.canCatalog ? <form className="card form-grid" onSubmit={(event) => submit(event, "/api/operations/cafeteria/items", (form) => ({ code: form.get("code"), name: form.get("name"), category: form.get("category") }))}>
        <h2>Add catalog item</h2>
        <label>Item code<input name="code" required maxLength={40} /></label>
        <label>Item name<input name="name" required maxLength={100} /></label>
        <label>Category<input name="category" required maxLength={60} /></label>
        <button className="button" type="submit">Save item</button>
      </form> : null}
      {props.canMenus ? <form className="card form-grid" onSubmit={(event) => submit(event, "/api/operations/cafeteria/menus", (form) => ({ menuDate: form.get("menuDate"), mealPlanName: form.get("mealPlanName"), items: [{ itemKey: form.get("itemKey"), mealSlot: form.get("mealSlot") }] }))}>
        <h2>Create daily menu</h2>
        <label>Date<input name="menuDate" type="date" required /></label>
        <label>Meal plan code<input name="mealPlanName" maxLength={40} pattern="[A-Za-z0-9._/-]+" placeholder="STANDARD" /></label>
        <label>Item<select name="itemKey" required><option value="">Select</option>{data?.items.filter((row: any) => row.status === "ACTIVE" && row.available).map((row: any) => <option key={row.publicKey} value={row.publicKey}>{row.code} · {row.name}</option>)}</select></label>
        <label>Meal slot<select name="mealSlot"><option value="BREAKFAST">Breakfast</option><option value="LUNCH">Lunch</option><option value="SNACK">Snack</option></select></label>
        <button className="button" type="submit">Save menu</button>
      </form> : null}
      {props.canEnrollments ? <form className="card form-grid" onSubmit={(event) => submit(event, "/api/operations/cafeteria/enrollments", (form) => {
        const admissionNo = String(form.get("admissionNo") ?? "");
        const current = data?.enrollments.find((row: any) => row.student.admissionNo === admissionNo && row.open);
        return { admissionNo, mealPlanName: form.get("mealPlanName"), effectiveFrom: form.get("effectiveFrom"), effectiveTo: form.get("effectiveTo"), changeReason: form.get("changeReason"), expectedCurrentEnrollmentKey: current?.publicKey, expectedCurrentVersion: current?.version };
      })}>
        <h2>Student opt-in</h2>
        <label>Student<select name="admissionNo" required><option value="">Select</option>{data?.students.map((row: any) => <option key={row.admissionNo} value={row.admissionNo}>{row.admissionNo} · {row.studentName}</option>)}</select></label>
        <label>Meal plan code<input name="mealPlanName" maxLength={40} pattern="[A-Za-z0-9._/-]+" placeholder="STANDARD" /></label>
        <label>Effective from<input name="effectiveFrom" type="date" required /></label>
        <label>Effective to (optional)<input name="effectiveTo" type="date" /></label>
        <label className="span-2">Reason code<select name="changeReason" required><option value="INITIAL_OPT_IN">Initial opt-in</option><option value="PLAN_CHANGE">Plan change</option><option value="PARENT_REQUEST">Parent request</option><option value="SERVICE_CHANGE">Service change</option><option value="ADMIN_CORRECTION">Administrative correction</option></select></label>
        <button className="button" type="submit">Save opt-in</button>
      </form> : null}
      {props.canMeals ? <form className="card form-grid" onSubmit={(event) => submit(event, "/api/operations/cafeteria/meals", (form) => ({ admissionNo: form.get("admissionNo"), menuItemKey: form.get("menuItemKey"), serviceDate: form.get("serviceDate"), mealSlot: form.get("mealSlot"), recordType: form.get("recordType"), idempotencyKey: crypto.randomUUID() }))}>
        <h2>Meal record</h2>
        <label>Student<select name="admissionNo" required><option value="">Select</option>{data?.students.map((row: any) => <option key={row.admissionNo} value={row.admissionNo}>{row.admissionNo} · {row.studentName}</option>)}</select></label>
        <label>Menu item<select name="menuItemKey" required><option value="">Select</option>{menuItems.map(({ menu, item }: any) => <option key={item.publicKey} value={item.publicKey}>{new Date(menu.menuDate).toISOString().slice(0, 10)} · {menu.mealPlanName} · {item.mealSlot} · {item.item.name}</option>)}</select></label>
        <label>Service date<input name="serviceDate" type="date" required /></label>
        <label>Meal slot<select name="mealSlot"><option value="BREAKFAST">Breakfast</option><option value="LUNCH">Lunch</option><option value="SNACK">Snack</option></select></label>
        <label>Record type<select name="recordType"><option value="ORDER">Order</option><option value="PARTICIPATION">Participation</option></select></label>
        <button className="button" type="submit">Record meal</button>
      </form> : null}
    </div>
    <section className="card"><div className="section-heading"><div><h2>Serving roster</h2><p>No medical, diagnosis, card, wallet, fee or receipt data.</p></div>{props.canReports ? <Link className="button secondary" href="/api/operations/cafeteria/reports/export">Export privacy-minimal CSV</Link> : null}</div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Student</th><th>Meal</th><th>Type</th><th>Status</th></tr></thead><tbody>{data?.mealRecords.map((row: any) => <tr key={row.publicKey}><td>{row.serviceDateKey}</td><td>{row.student.admissionNo} · {row.student.studentName}<br /><span className="muted">{row.student.className}{row.student.section ? `-${row.student.section}` : ""}</span></td><td>{row.mealSlot} · {row.menuItem.item.name}</td><td>{row.recordType}</td><td>{row.status}</td></tr>)}{!data?.mealRecords.length ? <tr><td colSpan={5}>No synthetic meal records.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
