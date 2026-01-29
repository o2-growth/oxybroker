import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { usePromotions, Promotion, PromotionSchedule, PromotionEligibility } from "@/hooks/usePromotions";
import { useCategories } from "@/hooks/useCategories";
import { useUsers } from "@/hooks/useUsers";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["discount", "cashback"]),
  applies_to: z.enum(["topup", "bid", "purchase"]),
  benefit_type: z.enum(["percentage", "fixed"]),
  benefit_value: z.coerce.number().positive("Valor deve ser maior que zero"),
  min_amount: z.coerce.number().min(0).optional(),
  max_benefit: z.coerce.number().positive().optional().nullable(),
  eligibility: z.enum(["global", "category", "individual"]),
  is_active: z.boolean(),
  // Schedule
  schedule_type: z.enum(["one_time", "recurring", "none"]),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  days_of_week: z.array(z.number()).optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  // Eligibility
  category_ids: z.array(z.string()).optional(),
  user_ids: z.array(z.string()).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PromotionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotion?: Promotion | null;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export function PromotionFormModal({ open, onOpenChange, promotion }: PromotionFormModalProps) {
  const { createPromotion, updatePromotion } = usePromotions();
  const { categories } = useCategories();
  const { users } = useUsers();
  const isEditing = !!promotion;

  // Fetch schedule and eligibility for editing
  const { data: promotionDetails } = useQuery({
    queryKey: ["promotion-details", promotion?.id],
    queryFn: async () => {
      if (!promotion?.id) return null;

      const [scheduleRes, eligibilityRes] = await Promise.all([
        supabase.from("promotion_schedules").select("*").eq("promotion_id", promotion.id),
        supabase.from("promotion_eligibility").select("*").eq("promotion_id", promotion.id),
      ]);

      return {
        schedule: scheduleRes.data?.[0] as PromotionSchedule | undefined,
        eligibility: eligibilityRes.data as PromotionEligibility[] | undefined,
      };
    },
    enabled: !!promotion?.id && open,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "discount",
      applies_to: "topup",
      benefit_type: "percentage",
      benefit_value: 10,
      min_amount: 0,
      max_benefit: null,
      eligibility: "global",
      is_active: true,
      schedule_type: "none",
      starts_at: "",
      ends_at: "",
      days_of_week: [],
      start_time: "",
      end_time: "",
      category_ids: [],
      user_ids: [],
    },
  });

  // Reset form when modal opens/closes or promotion changes
  useEffect(() => {
    if (open && promotion) {
      const schedule = promotionDetails?.schedule;
      const eligibility = promotionDetails?.eligibility;

      form.reset({
        name: promotion.name,
        description: promotion.description || "",
        type: promotion.type,
        applies_to: promotion.applies_to,
        benefit_type: promotion.benefit_type,
        benefit_value: promotion.benefit_value,
        min_amount: promotion.min_amount || 0,
        max_benefit: promotion.max_benefit,
        eligibility: promotion.eligibility,
        is_active: promotion.is_active,
        schedule_type: schedule?.schedule_type || "none",
        starts_at: schedule?.starts_at ? schedule.starts_at.slice(0, 16) : "",
        ends_at: schedule?.ends_at ? schedule.ends_at.slice(0, 16) : "",
        days_of_week: schedule?.days_of_week || [],
        start_time: schedule?.start_time || "",
        end_time: schedule?.end_time || "",
        category_ids: eligibility?.filter((e) => e.category_id).map((e) => e.category_id!) || [],
        user_ids: eligibility?.filter((e) => e.user_id).map((e) => e.user_id!) || [],
      });
    } else if (open && !promotion) {
      form.reset({
        name: "",
        description: "",
        type: "discount",
        applies_to: "topup",
        benefit_type: "percentage",
        benefit_value: 10,
        min_amount: 0,
        max_benefit: null,
        eligibility: "global",
        is_active: true,
        schedule_type: "none",
        starts_at: "",
        ends_at: "",
        days_of_week: [],
        start_time: "",
        end_time: "",
        category_ids: [],
        user_ids: [],
      });
    }
  }, [open, promotion, promotionDetails, form]);

  const watchEligibility = form.watch("eligibility");
  const watchScheduleType = form.watch("schedule_type");
  const watchBenefitType = form.watch("benefit_type");

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      description: data.description,
      type: data.type,
      applies_to: data.applies_to,
      benefit_type: data.benefit_type,
      benefit_value: data.benefit_value,
      min_amount: data.min_amount,
      max_benefit: data.max_benefit,
      eligibility: data.eligibility,
      is_active: data.is_active,
      schedule_type: data.schedule_type !== "none" ? data.schedule_type : undefined,
      starts_at: data.schedule_type === "one_time" && data.starts_at ? data.starts_at : undefined,
      ends_at: data.schedule_type === "one_time" && data.ends_at ? data.ends_at : undefined,
      days_of_week: data.schedule_type === "recurring" ? data.days_of_week : undefined,
      start_time: data.schedule_type === "recurring" && data.start_time ? data.start_time : undefined,
      end_time: data.schedule_type === "recurring" && data.end_time ? data.end_time : undefined,
      category_ids: data.eligibility === "category" ? data.category_ids : undefined,
      user_ids: data.eligibility === "individual" ? data.user_ids : undefined,
    };

    if (isEditing && promotion) {
      await updatePromotion.mutateAsync({ id: promotion.id, ...payload });
    } else {
      await createPromotion.mutateAsync(payload);
    }

    onOpenChange(false);
  };

  const isSubmitting = createPromotion.isPending || updatePromotion.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Promoção" : "Nova Promoção"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as configurações da promoção."
              : "Configure uma nova promoção para seus usuários."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Black Friday" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva a promoção..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo do Benefício</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="discount" id="type-discount" />
                        <Label htmlFor="type-discount">Desconto</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cashback" id="type-cashback" />
                        <Label htmlFor="type-cashback">Cashback</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>
                    Desconto reduz o valor pago. Cashback devolve valor após a transação.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Applies To */}
            <FormField
              control={form.control}
              name="applies_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Onde Aplicar</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="topup">Recargas (top-up)</SelectItem>
                      <SelectItem value="bid">Lances</SelectItem>
                      <SelectItem value="purchase">Compras (encerramento/compra imediata)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Benefit Value */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="benefit_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Valor</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="percentage" id="benefit-percent" />
                          <Label htmlFor="benefit-percent">Percentual</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="fixed" id="benefit-fixed" />
                          <Label htmlFor="benefit-fixed">Valor Fixo</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="benefit_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchBenefitType === "percentage" ? "Percentual (%)" : "Valor (R$)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step={watchBenefitType === "percentage" ? "0.1" : "0.01"}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Min/Max */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="min_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Mínimo (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormDescription>Valor mínimo da transação para aplicar</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_benefit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limite Máximo (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Sem limite"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>Valor máximo do benefício</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Eligibility */}
            <FormField
              control={form.control}
              name="eligibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Elegibilidade</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-wrap gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="global" id="elig-global" />
                        <Label htmlFor="elig-global">Global (todos)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="category" id="elig-category" />
                        <Label htmlFor="elig-category">Por Categoria</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="individual" id="elig-individual" />
                        <Label htmlFor="elig-individual">Usuários Específicos</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category Selection */}
            {watchEligibility === "category" && (
              <FormField
                control={form.control}
                name="category_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categorias</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <label
                          key={cat.id}
                          className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted"
                        >
                          <Checkbox
                            checked={field.value?.includes(cat.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...(field.value || []), cat.id]);
                              } else {
                                field.onChange(field.value?.filter((id) => id !== cat.id));
                              }
                            }}
                          />
                          <span className="text-sm">{cat.name}</span>
                        </label>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* User Selection */}
            {watchEligibility === "individual" && (
              <FormField
                control={form.control}
                name="user_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuários</FormLabel>
                    <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                      {users.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted"
                        >
                          <Checkbox
                            checked={field.value?.includes(user.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...(field.value || []), user.id]);
                              } else {
                                field.onChange(field.value?.filter((id) => id !== user.id));
                              }
                            }}
                          />
                          <span className="text-sm">
                            {user.full_name || user.email || user.id}
                          </span>
                        </label>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Schedule */}
            <FormField
              control={form.control}
              name="schedule_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agendamento</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-wrap gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="none" id="sched-none" />
                        <Label htmlFor="sched-none">Sempre ativa</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="one_time" id="sched-once" />
                        <Label htmlFor="sched-once">Período único</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="recurring" id="sched-recurring" />
                        <Label htmlFor="sched-recurring">Recorrente</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* One-time Schedule */}
            {watchScheduleType === "one_time" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="starts_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ends_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fim</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Recurring Schedule */}
            {watchScheduleType === "recurring" && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="days_of_week"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dias da Semana</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <label
                            key={day.value}
                            className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted"
                          >
                            <Checkbox
                              checked={field.value?.includes(day.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...(field.value || []), day.value]);
                                } else {
                                  field.onChange(field.value?.filter((d) => d !== day.value));
                                }
                              }}
                            />
                            <span className="text-sm">{day.label}</span>
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="start_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário de Início</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="end_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário de Fim</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Active Status */}
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel className="text-base">Promoção Ativa</FormLabel>
                    <FormDescription>
                      Ative para que os usuários possam usar esta promoção.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Salvar Alterações" : "Criar Promoção"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
