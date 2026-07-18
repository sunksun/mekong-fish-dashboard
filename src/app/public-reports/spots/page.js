'use client';

import PublicReportLayout from '@/components/Layout/PublicReportLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { USER_ROLES } from '@/types';
import SpotsReportContent from '@/components/reports/SpotsReportContent';

export default function PublicSpotsReportPage() {
  return (
    <ProtectedRoute requiredRoles={[USER_ROLES.MEMBER]} fallbackPath="/login">
      <PublicReportLayout>
        <SpotsReportContent />
      </PublicReportLayout>
    </ProtectedRoute>
  );
}
