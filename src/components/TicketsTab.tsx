import { useParams } from 'react-router-dom';
import type { TicketSummary } from '../../server/types';
import { useTickets } from '../lib/api';
import { stateColorClass, stateLabel } from '../lib/ticketState';

export function TicketsTab() {
  const { name } = useParams<{ name: string }>();
  const { data: tickets, isLoading, error } = useTickets(name ?? null, 'Task');

  if (isLoading) {
    return <div className="p-6 text-nord-4">Loading tickets…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-nord-2 border border-nord-11 rounded p-4 text-nord-11 text-sm">
          Failed to load tickets:{' '}
          {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <div className="p-6 text-nord-4">No tickets in this project yet.</div>
    );
  }

  return (
    <div className="p-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-nord-4 border-b border-nord-3">
            <th className="pb-2 pr-4 font-medium">ID</th>
            <th className="pb-2 pr-4 font-medium">Title</th>
            <th className="pb-2 pr-4 font-medium">State</th>
            <th className="pb-2 font-medium">Epic</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t: TicketSummary) => {
            const epicLabel = t.epicTitle ?? (t.epic !== undefined ? `#${t.epic}` : null);
            return (
              <tr
                key={t.number}
                className="border-b border-nord-3 hover:bg-nord-2 transition-colors"
              >
                <td className="py-2 pr-4 font-mono text-nord-8 whitespace-nowrap">
                  {t.displayId}
                </td>
                <td className="py-2 pr-4 text-nord-6">{t.title}</td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${stateColorClass(
                      t.state,
                    )}`}
                  >
                    {stateLabel(t.state)}
                  </span>
                </td>
                <td className="py-2">
                  {epicLabel !== null && (
                    <span
                      className="inline-block max-w-[14rem] truncate align-middle px-2 py-0.5 rounded bg-nord-15/20 text-nord-15 text-xs font-medium"
                      title={epicLabel}
                    >
                      {epicLabel}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
