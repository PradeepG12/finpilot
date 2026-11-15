import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { ApiResponse, GoalItem } from '@/types/api';
import { formatINR, formatDate, formatPercent } from '@/lib/format';
import { Plus, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

interface Props {
  customerCode: string;
}

export const CustomerGoalsTab: React.FC<Props> = ({ customerCode }) => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);

  const [goalName, setGoalName] = useState('');
  const [goalType, setGoalType] = useState('RETIREMENT');
  const [targetAmount, setTargetAmount] = useState('');
  const [fundedAmount, setFundedAmount] = useState('0');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: goals, isLoading } = useQuery({
    queryKey: ['goals', customerCode],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<GoalItem[]>>(`/customers/${customerCode}/goals/`);
      return res.data.data;
    },
  });

  const saveGoalMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        goal_name: goalName,
        goal_type: goalType,
        target_amount: targetAmount,
        current_funded_amount: fundedAmount,
        target_date: targetDate,
        priority: priority,
      };

      if (editingGoal) {
        await apiClient.patch(`/goals/${editingGoal.uuid}/`, payload);
      } else {
        await apiClient.post(`/customers/${customerCode}/goals/`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', customerCode] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerCode] });
      closeModal();
    },
    onError: (err: any) => {
      const detail = err.response?.data?.data?.detail || err.response?.data?.data?.current_funded_amount?.[0] || 'Validation error.';
      setFormError(detail);
    },
  });

  const openCreateModal = () => {
    setEditingGoal(null);
    setGoalName('');
    setGoalType('RETIREMENT');
    setTargetAmount('');
    setFundedAmount('0');
    setTargetDate('');
    setPriority('MEDIUM');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (goal: GoalItem) => {
    setEditingGoal(goal);
    setGoalName(goal.goal_name);
    setGoalType(goal.goal_type);
    setTargetAmount(goal.target_amount);
    setFundedAmount(goal.current_funded_amount);
    setTargetDate(goal.target_date);
    setPriority(goal.priority);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGoal(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    saveGoalMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-text-main">Life Goals Tracking</h2>
          <p className="text-xs text-text-muted">Targeted planning for retirement, wealth creation, education & more.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          <span>Add Goal</span>
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-text-muted p-4">Loading financial goals...</div>
      ) : goals?.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted text-sm">
          No goals recorded for this customer yet. Click "Add Goal" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals?.map((goal) => {
            const pct = parseFloat(goal.funded_percent);
            const isFunded = goal.flags.includes('FUNDED');
            const isOverdue = goal.flags.includes('OVERDUE');
            const isInconsistent = goal.flags.includes('INCONSISTENT');

            return (
              <div
                key={goal.id}
                onClick={() => openEditModal(goal)}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm hover:border-primary cursor-pointer transition-colors space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono font-bold text-primary">{goal.goal_code}</span>
                    <h3 className="font-bold text-text-main text-base mt-0.5">{goal.goal_name}</h3>
                    <div className="text-xs text-text-muted capitalize">{goal.goal_type.toLowerCase().replace('_', ' ')}</div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      goal.priority === 'HIGH'
                        ? 'bg-red-100 text-red-800'
                        : goal.priority === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {goal.priority}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-text-muted">Target: {formatINR(goal.target_amount)}</span>
                    <span className="text-text-main tabular-nums">{formatPercent(pct)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        isFunded ? 'bg-gain' : isOverdue ? 'bg-loss' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>Funded: {formatINR(goal.current_funded_amount)}</span>
                    <span>Target: {formatDate(goal.target_date)}</span>
                  </div>
                </div>

                {/* Flags */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                  {isFunded && (
                    <span className="inline-flex items-center text-xs text-gain bg-green-50 px-2 py-0.5 rounded font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Funded
                    </span>
                  )}
                  {isOverdue && (
                    <span className="inline-flex items-center text-xs text-loss bg-red-50 px-2 py-0.5 rounded font-medium">
                      <AlertCircle className="h-3.5 w-3.5 mr-1" /> Overdue
                    </span>
                  )}
                  {isInconsistent && (
                    <span className="inline-flex items-center text-xs text-warning bg-amber-50 px-2 py-0.5 rounded font-medium">
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Overfunded
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-xl border border-border">
            <h3 className="text-lg font-bold text-text-main">
              {editingGoal ? `Edit Goal (${editingGoal.goal_code})` : 'Create New Goal'}
            </h3>

            {formError && (
              <div className="mt-3 rounded-md bg-red-50 p-3 text-xs text-loss border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-main">Goal Name</label>
                <input
                  type="text"
                  required
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-transparent"
                  placeholder="e.g. Primary Retirement Portfolio"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-main">Goal Type</label>
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-transparent"
                  >
                    <option value="RETIREMENT">Retirement</option>
                    <option value="EDUCATION">Education</option>
                    <option value="EMERGENCY_FUND">Emergency Fund</option>
                    <option value="TRAVEL">Travel</option>
                    <option value="WEALTH_CREATION">Wealth Creation</option>
                    <option value="HOME_PURCHASE">Home Purchase</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-main">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-transparent"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-main">Target Amount (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-main">Funded Amount (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={fundedAmount}
                    onChange={(e) => setFundedAmount(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-main">Target Date</label>
                <input
                  type="date"
                  required
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-transparent"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm rounded-md border border-slate-300 text-text-main"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveGoalMutation.isPending}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saveGoalMutation.isPending ? 'Saving...' : 'Save Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
