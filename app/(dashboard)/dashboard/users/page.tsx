"use client";

import { useDashboardSession } from '../../../../components/layout/dashboard-session';

export default function UsersManagementPage() {
  const { user, loading } = useDashboardSession();

  if (loading || !user) return null;

  const mockUsers = [
    { name: 'Ria Sen', email: 'ria@create.wtf', role: 'employee', status: 'active' },
    { name: 'Arjun Mehta', email: 'arjun@create.wtf', role: 'team_lead', status: 'active' },
    { name: 'Nisha Rao', email: 'nisha@create.wtf', role: 'finance', status: 'active' },
    { name: 'Admin Ops', email: 'admin@create.wtf', role: 'admin', status: 'active' },
    { name: 'Platform Dev', email: 'developer@create.wtf', role: 'developer', status: 'active' },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ margin: 0 }}>User Management</h1>
        <p className="text-muted">Admin-only visibility for provisioned users, role assignment, and account status management.</p>
      </header>

      <div className="surface" style={{ padding: 16 }}>
        <strong>Signed in as:</strong> {user.full_name} ({user.role})
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {mockUsers.map((entry) => (
              <tr key={entry.email}>
                <td>{entry.name}</td>
                <td>{entry.email}</td>
                <td><span className="badge badge-submitted">{entry.role}</span></td>
                <td><span className="badge badge-accepted">{entry.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
