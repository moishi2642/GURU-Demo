import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAssetSchema, insertLiabilitySchema, insertCashFlowSchema } from "@shared/schema";
import { useCreateAsset, useCreateLiability, useCreateCashFlow } from "@/hooks/use-financials";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, DollarSign, TrendingDown, RefreshCcw } from "lucide-react";

type DialogType = 'asset' | 'liability' | 'cashFlow';

interface Props {
  clientId: number;
  type: DialogType;
}

export function AddFinancialsDialog({ clientId, type }: Props) {
  const [open, setOpen] = useState(false);
  
  const createAsset = useCreateAsset(clientId);
  const createLiability = useCreateLiability(clientId);
  const createCashFlow = useCreateCashFlow(clientId);

  const isPending = createAsset.isPending || createLiability.isPending || createCashFlow.isPending;

  // Unified form schema for simplicity, fields are conditionally validated/used
  const formSchema = z.object({
    description: z.string().min(1, "Description is required"),
    value: z.string().min(1, "Amount is required"),
    category: z.string().min(1, "Category/Type is required"),
    // Liability only
    interestRate: z.string().optional(),
    // Cash Flow only
    date: z.string().optional(),
    cfType: z.enum(["inflow", "outflow"]).optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      value: "",
      category: type === 'asset' ? 'equity' : type === 'liability' ? 'mortgage' : 'salary',
      interestRate: "0",
      date: new Date().toISOString().split('T')[0],
      cfType: "inflow",
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    if (type === 'asset') {
      createAsset.mutate({
        clientId,
        description: data.description,
        value: data.value,
        type: data.category,
      }, { onSuccess: () => { setOpen(false); form.reset(); } });
    } else if (type === 'liability') {
      createLiability.mutate({
        clientId,
        description: data.description,
        value: data.value,
        type: data.category,
        interestRate: data.interestRate || "0",
      }, { onSuccess: () => { setOpen(false); form.reset(); } });
    } else if (type === 'cashFlow') {
      createCashFlow.mutate({
        clientId,
        description: data.description,
        amount: data.value,
        category: data.category,
        type: data.cfType || "inflow",
        date: new Date(data.date!).toISOString(),
      }, { onSuccess: () => { setOpen(false); form.reset(); } });
    }
  };

  const config = {
    asset: {
      title: "Add Asset",
      desc: "Record a new asset to the client's balance sheet.",
      icon: DollarSign,
      categories: [
        { label: "Equity", value: "equity" },
        { label: "Fixed Income", value: "fixed_income" },
        { label: "Real Estate", value: "real_estate" },
        { label: "Cash & Equivalents", value: "cash" },
        { label: "Alternative", value: "alternative" },
      ]
    },
    liability: {
      title: "Add Liability",
      desc: "Record a new liability or debt.",
      icon: TrendingDown,
      categories: [
        { label: "Mortgage", value: "mortgage" },
        { label: "Personal Loan", value: "personal_loan" },
        { label: "Margin Debt", value: "margin_debt" },
        { label: "Auto Loan", value: "auto_loan" },
      ]
    },
    cashFlow: {
      title: "Add Cash Flow",
      desc: "Record a historical or projected cash flow event.",
      icon: RefreshCcw,
      categories: [
        { label: "Salary/Wages", value: "salary" },
        { label: "Business Income", value: "business" },
        { label: "Investment Income", value: "investment" },
        { label: "Living Expenses", value: "living_expenses" },
        { label: "Taxes", value: "taxes" },
        { label: "Major Purchase", value: "major_purchase" },
      ]
    }
  }[type];

  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 glass-card hover:bg-primary/5 hover:text-primary transition-all">
          <Icon className="h-4 w-4" />
          {config.title}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{config.title}</DialogTitle>
          <DialogDescription>{config.desc}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Primary Residence" className="bg-muted/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="100000" className="bg-muted/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted/50">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {config.categories.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {type === 'liability' && (
              <FormField
                control={form.control}
                name="interestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="4.5" className="bg-muted/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {type === 'cashFlow' && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cfType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/50">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="inflow">Inflow (+)</SelectItem>
                          <SelectItem value="outflow">Outflow (-)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" className="bg-muted/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  "Save Entry"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
