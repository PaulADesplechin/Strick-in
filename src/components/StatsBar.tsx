"use client";

interface StatsBarProps {
  total: number;
  filtered: number;
  categories: number;
}

export function StatsBar({ total, filtered, categories }: StatsBarProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="card flex items-center gap-4">
        <div className="w-12 h-12 bg-violet-light rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-violet" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <p className="text-2xl font-display font-bold text-violet">{total}</p>
          <p className="text-xs text-gray-500">Documents totaux</p>
        </div>
      </div>
      <div className="card flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <div>
          <p className="text-2xl font-display font-bold text-cobalt">{categories}</p>
          <p className="text-xs text-gray-500">Catégories</p>
        </div>
      </div>
      <div className="card flex items-center gap-4">
        <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        <div>
          <p className="text-2xl font-display font-bold text-green-600">{filtered}</p>
          <p className="text-xs text-gray-500">Affichés</p>
        </div>
      </div>
    </div>
  );
}
