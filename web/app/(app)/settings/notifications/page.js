'use client';
import { BellOff } from 'lucide-react';
import { Card, EmptyState, Button } from '@/components/ui';

export default function Notifications() {
  return (
    <Card title="Notifications">
      <EmptyState icon={BellOff} title="Email and Slack alerts aren’t set up yet" actions={<Button href="/">Back to overview</Button>}>
        For now, the bell in the top bar shows live counts of what needs attention: lines to review, claims to file, missing returns and failed uploads.
      </EmptyState>
    </Card>
  );
}
