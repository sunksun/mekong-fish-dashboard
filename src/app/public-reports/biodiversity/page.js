'use client';

import PublicReportLayout from '@/components/Layout/PublicReportLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { USER_ROLES } from '@/types';
import BiodiversityReportContent from '@/components/reports/BiodiversityReportContent';

export default function PublicBiodiversityReportPage() {
  return (
    <ProtectedRoute requiredRoles={[USER_ROLES.MEMBER]} fallbackPath="/login">
      <PublicReportLayout>
        <BiodiversityReportContent />
      </PublicReportLayout>
    </ProtectedRoute>
  );
}
