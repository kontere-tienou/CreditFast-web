import {
  fetchAccountCheck,
  fetchClientProfile,
  fetchFinancialProfile,
  listEconomicActivities,
  saveEconomicActivity,
  updateClientProfile,
} from "@/api/profile";
import { notifyProfileChanged } from "@/features/workflow/workflow";

function fieldValue(id: string) {
  return String(
    (
      document.getElementById(id) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null
    )?.value ?? "",
  ).trim();
}

function fieldNumber(id: string) {
  const value = Number(fieldValue(id).replace(/\s/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function setField(id: string, value?: string | number | null) {
  const node = document.getElementById(id) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  if (!node || value == null || value === "") {
    return;
  }
  if (
    node instanceof HTMLSelectElement &&
    ![...node.options].some((option) => option.value === String(value))
  ) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    node.appendChild(option);
  }
  node.value = String(value);
  node.dispatchEvent(new Event("input", { bubbles: true }));
  node.dispatchEvent(new Event("change", { bubbles: true }));
}

function splitCity(raw: string) {
  const [city, ...rest] = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return { city: city || undefined, zone: rest.join(", ") || undefined };
}

export async function persistWizardFiche() {
  const cityRaw = fieldValue("wiz-city");
  const { city, zone } = splitCity(cityRaw);
  const sector = fieldValue("wiz-sector");
  const location = fieldValue("wiz-location");
  const income = fieldNumber("wiz-income");
  const seniority = fieldNumber("wiz-seniority");
  const existingActivityId = Number(fieldValue("wiz-activity-id")) || undefined;

  if (city || zone || sector) {
    await updateClientProfile({
      city: city ?? null,
      residential_zone: zone ?? null,
      occupation: sector || null,
      address: location || cityRaw || null,
    });
  }

  let activityId = existingActivityId;
  if (sector && income > 0) {
    const startDate =
      seniority > 0
        ? `${new Date().getFullYear() - Math.round(seniority)}-01-01`
        : undefined;
    const saved = await saveEconomicActivity(
      {
        activity_type: sector,
        sector,
        location: location || null,
        monthly_revenue: income,
        start_date: startDate ?? null,
      },
      existingActivityId,
    );
    activityId = saved?.id ?? existingActivityId;
    if (activityId) {
      setField("wiz-activity-id", activityId);
    }
  }

  notifyProfileChanged();
  return { activityId };
}

export async function hydrateWizardFromProfile(draft?: {
  id?: number;
  requested_amount?: number;
  duration_months?: number;
  purpose?: string;
  credit_type?: string | null;
  declared_monthly_income?: number;
  declared_monthly_expenses?: number;
  activity_id?: number;
}) {
  const [profile, checked, financial, activities] = await Promise.all([
    fetchClientProfile().catch(() => null),
    fetchAccountCheck().catch(() => null),
    fetchFinancialProfile().catch(() => null),
    listEconomicActivities().catch(() => []),
  ]);
  const activity =
    activities.find((row) => row.id === draft?.activity_id) ?? activities[0];
  const sessionName = document.getElementById(
    "wiz-fullname",
  ) as HTMLInputElement | null;
  if (sessionName && !sessionName.value) {
    const name =
      profile?.user?.full_name ||
      [profile?.user?.first_name, profile?.user?.last_name]
        .filter(Boolean)
        .join(" ");
    if (name) {
      sessionName.value = name;
    }
  }
  const phone = document.getElementById("wiz-phone") as HTMLInputElement | null;
  if (phone && !phone.value && profile?.user?.phone) {
    phone.value = profile.user.phone;
  }
  if (profile?.city || profile?.residential_zone) {
    setField(
      "wiz-city",
      [profile.city, profile.residential_zone].filter(Boolean).join(", "),
    );
  }
  if (activity?.sector || activity?.activity_type || profile?.occupation) {
    setField(
      "wiz-sector",
      activity?.sector || activity?.activity_type || profile?.occupation || "",
    );
  }
  if (activity?.location) {
    setField("wiz-location", activity.location);
  }
  if (activity?.id) {
    setField("wiz-activity-id", activity.id);
  }
  setField("wiz-income", checked?.monthly_income ?? 0);
  setField("wiz-expenses", checked?.monthly_expenses ?? 0);
  setField("wiz-debt", checked?.existing_debt_payment ?? 0);
  if (financial?.dependents_count != null) {
    setField("wiz-dependents", financial.dependents_count);
  }
  if (draft?.id) {
    setField("wiz-draft-id", draft.id);
  }
  if (draft?.requested_amount) {
    setField("wiz-amount", draft.requested_amount);
  }
  if (draft?.duration_months) {
    setField("wiz-duration", draft.duration_months);
  }
  if (draft?.credit_type) {
    setField("wiz-credit-type", draft.credit_type);
  }
  if (draft?.purpose) {
    setField("wiz-purpose", draft.purpose);
  }
}
