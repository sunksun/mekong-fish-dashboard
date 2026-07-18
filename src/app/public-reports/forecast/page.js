'use client';

import PublicReportLayout from '@/components/Layout/PublicReportLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { USER_ROLES } from '@/types';
import ForecastReportContent from '@/components/reports/ForecastReportContent';

export default function PublicForecastReportPage() {
  return (
    <ProtectedRoute requiredRoles={[USER_ROLES.MEMBER]} fallbackPath="/login">
      <PublicReportLayout>
        <ForecastReportContent />
      </PublicReportLayout>
    </ProtectedRoute>
  );
}
