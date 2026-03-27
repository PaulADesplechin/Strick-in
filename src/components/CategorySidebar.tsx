"use client";

interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
}

interface CategorySidebarProps {
  categories: readonly Category[];
  counts: Record<string, number>;
  active: string | null;
  onSelect: (id: string | null) => void;
}

export function CategorySidebar({ categories, counts, active, onSelect }: CategorySidebarProps) {
  return (
    <div className="w-64 shrink-0 hidden lg:block">
      <div className="card p-2 sticky top-24 space-y-1">
        <button
          onClick={() => onSelect(null)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            active === null
              ? "bg-violet text-white"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <span>Tous les documents</span>
          <span className={`text-xs ${active === null ? "text-white/70" : "text-gray-400"}`}>
            {Object.values(counts).reduce((a, b) => a + b, 0)}
          </span>
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(active === cat.id ? null : cat.id)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              active === cat.id
                ? "bg-violet text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className="truncate">{cat.label}</span>
            <span className={`text-xs ${active === cat.id ? "text-white/70" : "text-gray-400"}`}>
              {counts[cat.id] || 0}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
