/** Permissions managers can toggle on company roles, grouped with Dutch labels. */
export const PERMISSION_GROUPS: {
  title: string;
  items: { key: string; label: string }[];
}[] = [
  {
    title: "Producten",
    items: [{ key: "products.view", label: "Producten bekijken & bestellen openen" }],
  },
  {
    title: "Bestellen",
    items: [
      { key: "orders.create", label: "Bestellingen plaatsen" },
      { key: "orders.view_own", label: "Eigen bestellingen bekijken" },
      { key: "orders.view_all", label: "Alle bedrijfsbestellingen bekijken" },
      { key: "orders.approve", label: "Bestellingen goedkeuren / afwijzen" },
      { key: "orders.cancel", label: "Eigen bestellingen annuleren" },
    ],
  },
  {
    title: "Gebruikers",
    items: [
      { key: "users.view", label: "Gebruikers bekijken" },
      { key: "users.invite", label: "Gebruikers toevoegen" },
      { key: "users.update", label: "Gebruikers bewerken" },
      { key: "users.remove", label: "Gebruikers deactiveren" },
    ],
  },
  {
    title: "Beheer",
    items: [
      { key: "roles.manage", label: "Rollen & rechten beheren" },
      { key: "settings.manage", label: "Instellingen, regels & budgetten" },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);
