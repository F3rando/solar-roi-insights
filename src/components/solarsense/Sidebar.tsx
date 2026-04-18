import { Home, Shield, DollarSign, Moon, Bell, Sun } from "lucide-react";

const items = [
  { icon: Home, label: "Overview", active: true },
  { icon: Shield, label: "Verified" },
  { icon: DollarSign, label: "Financial" },
  { icon: Moon, label: "Climate" },
  { icon: Bell, label: "Alerts" },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-16 shrink-0 flex-col items-center justify-between py-5 panel rounded-none border-y-0 border-l-0">
      <div className="flex flex-col items-center gap-2">
        <div className="size-10 rounded-xl grid place-items-center bg-gradient-to-br from-primary to-solar shadow-[var(--shadow-glow-primary)]">
          <Sun className="size-5 text-primary-foreground" />
        </div>
        <div className="mt-4 flex flex-col gap-1">
          {items.map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              title={label}
              className={`size-10 rounded-lg grid place-items-center transition ${
                active
                  ? "bg-primary/15 text-primary glow-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>
      <div className="size-9 rounded-full bg-accent grid place-items-center text-xs font-semibold">SS</div>
    </aside>
  );
}
