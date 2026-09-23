import { useEffect, useState } from "react";
import { apiJson } from "@/api/client";
import { LOCAL_WORKFLOW } from "@/app/runtimeMode";

type Zone = { code: string; name: string; agency_code?: string };
type AccountAgency = {
  account_type?: string;
  status?: string;
  agency_code?: string;
};

export function savingsAgencyCode(
  accounts: AccountAgency[],
  fallback?: string | null,
) {
  const codes = [
    ...new Set(
      accounts
        .filter((account) => {
          const type = (account.account_type || "").toUpperCase();
          return (
            (type.includes("EPARGNE") || type.includes("SAVING")) &&
            ["ACTIF", "ACTIVE"].includes(account.status || "") &&
            account.agency_code
          );
        })
        .map((account) => account.agency_code as string),
    ),
  ];
  return codes.length === 1 ? codes[0] : fallback || undefined;
}

export function ZoneSelect({
  value,
  onChange,
  agencyCode,
}: {
  value: string;
  onChange: (value: string) => void;
  agencyCode?: string;
}) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!LOCAL_WORKFLOW) return;
    let active = true;
    apiJson<{ zones: Zone[] }>("/routing/catalog")
      .then((data) => {
        if (active) setZones(data.zones);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  if (!LOCAL_WORKFLOW)
    return (
      <input
        className="form-control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  const visible = agencyCode
    ? zones.filter((zone) => zone.agency_code === agencyCode)
    : zones;
  const outside = Boolean(
    value && zones.length && !visible.some((zone) => zone.code === value),
  );
  return (
    <>
      <select
        className="form-control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Zone de résidence"
      >
        <option value="">Choisir une zone</option>
        {outside && (
          <option value={value}>{value} — hors de cette agence</option>
        )}
        {visible.map((zone) => (
          <option key={zone.code} value={zone.code}>
            {zone.name}
          </option>
        ))}
      </select>
      {outside && (
        <small role="alert">
          Cette zone n’appartient pas à l’agence du compte épargne. Choisissez
          une zone de cette agence, ou faites corriger le rattachement en
          agence.
        </small>
      )}
      {error && (
        <small role="alert">
          Les zones sont indisponibles. Rouvrez le profil pour réessayer.
        </small>
      )}
    </>
  );
}
