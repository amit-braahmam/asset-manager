export const HELP_SECTIONS = ["inventory", "maintenance", "people", "team", "reports"] as const;
export type HelpSection = (typeof HELP_SECTIONS)[number];

export type HelpGuide = {
  id: HelpSection;
  title: string;
  summary: string;
  steps: string[];
};

export const HELP_GUIDES: HelpGuide[] = [
  {
    id: "inventory",
    title: "Inventory",
    summary: "The live asset register: find a device, add one, import many, or open a record for assignment, status, photos, and warranty.",
    steps: [
      "Use search and the status, category, and location filters to narrow the table.",
      "Add asset creates a single record. Import inventory walks a CSV through column mapping before it writes.",
      "Select rows to bulk-update status. Managers and Admins can also delete.",
      "Open a row (or the arrow) for the asset detail: assignment, status, photos, warranty end, and history.",
      "The Warranty column turns red when the date has already passed.",
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance",
    summary: "One queue for device service and preventive fleet work (OS, applications, LAN, firewall).",
    steps: [
      "Device work is tied to one asset. Preventive work is fleet-wide and is not tied to a single device.",
      "Choose Scheduled or Emergency, set a technician and priority, then complete the item with outcome notes.",
      "Filters cover status, mode, scope, activity type, and priority. Attach photos when you schedule or complete work.",
      "Technicians can complete and edit items. Managers and Admins can also schedule and remove them.",
    ],
  },
  {
    id: "people",
    title: "People",
    summary: "Directory of people, departments, and locations. Assignments need these records first.",
    steps: [
      "Add a department, then people who belong to it. Add locations before you create or move assets.",
      "Import people with the CSV wizard when you have a roster to load in bulk.",
      "An asset can only be assigned to someone who already exists in this directory.",
      "Only Admins can see and edit Inventory and Maintenance dropdown options on this page.",
    ],
  },
  {
    id: "team",
    title: "Team",
    summary: "Who can sign in, and which role they hold in AssetControl.",
    steps: [
      "Roles: Admin, Auditor, Manager, Technician, Viewer. Each role is listed with what it can do.",
      "Managers can onboard teammates. Admins can change roles and remove members.",
      "A pending invite stays on the list until that person signs up with the same email.",
      "Team is visible to Admin, Auditor, and Manager. Inventory users without those roles will not see this section.",
    ],
  },
  {
    id: "reports",
    title: "Reports",
    summary: "The activity log for investigation, staged compliance reports, and custody checks.",
    steps: [
      "The activity log is every change across the estate, filterable by action and search.",
      "Start a compliance report, then move it In preparation → Ready for review → Final.",
      "Auditors and Admins can advance or edit reports. Only Admins can delete them.",
      "Start a custody check to ask assigned people to confirm they still have their equipment. Mail is queued and leaves in batches.",
      "When mail is off locally, Send next batch returns preview links so you can open the confirmation page without email.",
    ],
  },
];

export function helpSectionFromPath(pathname: string): HelpSection {
  if (pathname.startsWith("/maintenance")) return "maintenance";
  if (pathname.startsWith("/directory")) return "people";
  if (pathname.startsWith("/team")) return "team";
  if (pathname.startsWith("/reports")) return "reports";
  return "inventory";
}

export function helpGuide(id: HelpSection): HelpGuide {
  return HELP_GUIDES.find((guide) => guide.id === id) ?? HELP_GUIDES[0];
}
