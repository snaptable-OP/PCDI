import type { AssetType, StructuralType } from "@/lib/pcdi/types";

const STRUCTURAL_OPTIONS: { value: StructuralType; label: string }[] = [
  { value: "steel", label: "Steel" },
  { value: "concrete", label: "Concrete" },
  { value: "timber", label: "Timber" },
  { value: "masonry", label: "Masonry" },
  { value: "mixed", label: "Mixed" },
];

export type ProjectMetadataValues = {
  assetType: AssetType;
  floorLevels: string;
  location: string;
  structuralType: StructuralType;
};

type ProjectMetadataFormFieldsProps = {
  idPrefix: string;
  defaultValues: ProjectMetadataValues;
};

/**
 * Shared fields: asset, floors, location, structural (used on the metadata step after name-only create).
 */
export function ProjectMetadataFormFields({ idPrefix, defaultValues }: ProjectMetadataFormFieldsProps) {
  return (
    <>
      <div>
        <span className="block text-sm font-medium text-[var(--foreground)]" id={`${idPrefix}-assetType-label`}>
          Asset type
        </span>
        <div
          className="mt-2 flex gap-4"
          role="group"
          aria-labelledby={`${idPrefix}-assetType-label`}
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="assetType"
              value="residential"
              defaultChecked={defaultValues.assetType === "residential"}
            />
            Residential
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="assetType"
              value="commercial"
              defaultChecked={defaultValues.assetType === "commercial"}
            />
            Commercial
          </label>
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-floors`} className="block text-sm font-medium text-[var(--foreground)]">
          Floor levels
        </label>
        <input
          id={`${idPrefix}-floors`}
          name="floorLevels"
          autoComplete="off"
          defaultValue={defaultValues.floorLevels}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--ring)] focus:ring-2"
          placeholder="e.g. G + 18"
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-location`} className="block text-sm font-medium text-[var(--foreground)]">
          Location
        </label>
        <input
          id={`${idPrefix}-location`}
          name="location"
          autoComplete="off"
          defaultValue={defaultValues.location}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--ring)] focus:ring-2"
          placeholder="City or site"
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-structural`} className="block text-sm font-medium text-[var(--foreground)]">
          Structural type
        </label>
        <select
          id={`${idPrefix}-structural`}
          name="structuralType"
          defaultValue={defaultValues.structuralType}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--ring)] focus:ring-2"
        >
          {STRUCTURAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
