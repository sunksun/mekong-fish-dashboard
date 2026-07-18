'use client';

import PublicReportLayout from '@/components/Layout/PublicReportLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { USER_ROLES } from '@/types';
import CorrelationReportContent from '@/components/reports/CorrelationReportContent';

export default function PublicCorrelationReportPage() {
  return (
    <ProtectedRoute requiredRoles={[USER_ROLES.MEMBER]} fallbackPath="/login">
      <PublicReportLayout>
        <CorrelationReportContent />
      </PublicReportLayout>
    </ProtectedRoute>
  );
}
