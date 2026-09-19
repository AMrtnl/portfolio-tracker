import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useDemo } from '@/wealth/DemoContext'
import { mergeGoals } from '@/wealth/demo'

export interface Goal {
  id: string
  name: string
  targetAmount: number
  /** YYYY-MM-DD; absent means "whenever". */
  targetDate?: string
  /** Accounts whose balances count towards the goal. */
  accountIds: string[]
  monthlyContribution: number
  /** Yearly rate used for the projection, e.g. 0.04. */
  expectedReturn: number
  createdAt: string
  updatedAt: string
}

export interface GoalInput {
  name: string
  targetAmount: number
  targetDate?: string | null
  accountIds: string[]
  monthlyContribution: number
  expectedReturn: number
}

export function useGoals() {
  const { enabled } = useDemo()
  const query = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: async () => {
      const { data } = await axios.get('/api/goals')
      return data.goals as Goal[]
    },
  })
  return { ...query, data: mergeGoals(query.data, enabled) }
}

export function useAddGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: GoalInput) => {
      const { data } = await axios.post('/api/goals', input)
      return data as Goal
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<GoalInput>) => {
      const { data } = await axios.put(`/api/goals/${id}`, patch)
      return data as Goal
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/goals/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}
