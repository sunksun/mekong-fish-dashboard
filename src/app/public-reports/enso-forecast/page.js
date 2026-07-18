'use client';

import PublicReportLayout from '@/components/Layout/PublicReportLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { USER_ROLES } from '@/types';
import EnsoForecastReportContent from '@/components/reports/EnsoForecastReportContent';

export default function PublicEnsoForecastReportPage() {
  return (
    <ProtectedRoute requiredRoles={[USER_ROLES.MEMBER]} fallbackPath="/login">
      <PublicReportLayout>
        <EnsoForecastReportContent />
      </PublicReportLayout>
    </ProtectedRoute>
  );
}
