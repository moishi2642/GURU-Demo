import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateAsset, useCreateLiability, useCreateCashFlow } from "@/hooks/use-financials";
import { Plus } from "lucide-react";

export function AddAssetModal({ clientId }: { clientId: number }) {
  const [open, setOpen] = useState(false);
  const mutation = useCreateAsset(clientId);
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutation.mutate({
      clientId,
      type: fd.get("type") as string,
      value: fd.get("value") as string,
      description: fd.get("description") as string,
    }, {
      onSuccess: () => setOpen(false)
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-[rgba(255,255,255,0.55)] hover:text-[rgba(255,255,255,0.85)] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.10)] border border-[rgba(255,255,255,0.10)] text-xs font-semibold px-3 h-7 rounded-md shadow-none">
          <Plus className="w-3 h-3" />
          Add Asset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Asset</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="type">Asset Type</Label>
            <Select name="type" required defaultValue="equity">
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equity">Equity / Stocks</SelectItem>
                <SelectItem value="fixed_income">Fixed Income / Bonds</SelectItem>
                <SelectItem value="real_estate">Real Estate</SelectItem>
                <SelectItem value="cash">Cash & Equivalents</SelectItem>
                <SelectItem value="alternative">Alternative</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Current Value ($)</Label>
            <Input id="value" name="value" type="number" step="0.01" required placeholder="500000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description / Ticker</Label>
            <Input id="description" name="description" required placeholder="e.g. S&P 500 Index Fund" />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Adding..." : "Add Asset"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddLiabilityModal({ clientId }: { clientId: number }) {
  const [open, setOpen] = useState(false);
  const mutation = useCreateLiability(clientId);
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutation.mutate({
      clientId,
      type: fd.get("type") as string,
      value: fd.get("value") as string,
      interestRate: fd.get("interestRate") as string,
      description: fd.get("description") as string,
    }, {
      onSuccess: () => setOpen(false)
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-[rgba(255,255,255,0.55)] hover:text-[rgba(255,255,255,0.85)] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.10)] border border-[rgba(255,255,255,0.10)] text-xs font-semibold px-3 h-7 rounded-md shadow-none">
          <Plus className="w-3 h-3" />
          Add Liability
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Liability</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="type">Liability Type</Label>
            <Select name="type" required defaultValue="mortgage">
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mortgage">Mortgage</SelectItem>
                <SelectItem value="personal_loan">Personal Loan</SelectItem>
                <SelectItem value="auto_loan">Auto Loan</SelectItem>
                <SelectItem value="margin">Margin Debt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Outstanding Balance ($)</Label>
            <Input id="value" name="value" type="number" step="0.01" required placeholder="250000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="interestRate">Interest Rate (%)</Label>
            <Input id="interestRate" name="interestRate" type="number" step="0.01" required placeholder="5.25" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" required placeholder="e.g. Primary Residence Mortgage" />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Adding..." : "Add Liability"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddCashFlowModal({ clientId }: { clientId: number }) {
  const [open, setOpen] = useState(false);
  const mutation = useCreateCashFlow(clientId);
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutation.mutate({
      clientId,
      type: fd.get("type") as string,
      amount: fd.get("amount") as string,
      category: fd.get("category") as string,
      date: new Date(fd.get("date") as string),
      description: fd.get("description") as string,
    }, {
      onSuccess: () => setOpen(false)
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-[rgba(255,255,255,0.55)] hover:text-[rgba(255,255,255,0.85)] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.10)] border border-[rgba(255,255,255,0.10)] text-xs font-semibold px-3 h-7 rounded-md shadow-none">
          <Plus className="w-3 h-3" />
          Log Cash Flow
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Log Cash Flow Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Flow Type</Label>
              <Select name="type" required defaultValue="inflow">
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inflow">Inflow</SelectItem>
                  <SelectItem value="outflow">Outflow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required placeholder="5000" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select name="category" required defaultValue="salary">
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="salary">Salary / Wages</SelectItem>
                <SelectItem value="business">Business Income</SelectItem>
                <SelectItem value="living_expenses">Living Expenses</SelectItem>
                <SelectItem value="taxes">Taxes</SelectItem>
                <SelectItem value="investments">Investment Return</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description"