import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export const COMBO_AUTO = "__auto";

type ComboboxProps = {
  value: string;
  onValueChange: (v: string) => void;
  options: string[];
  placeholder: string;
  autoLabel?: string;
  format?: (v: string) => string;
  className?: string;
};

export function Combobox({ value, onValueChange, options, placeholder, autoLabel, format, className }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const fmt = format ?? ((v: string) => v);
  const trimmed = search.trim();
  const hasAuto = Boolean(autoLabel);
  const autoValue = hasAuto ? COMBO_AUTO : "";
  const exact = options.includes(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring",
            !exact && !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{!value || value === autoValue ? autoLabel || placeholder : fmt(value)}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={placeholder} />
          <CommandList className="max-h-72">
            {hasAuto && !trimmed && (
              <CommandItem
                value={COMBO_AUTO}
                onSelect={() => { onValueChange(autoValue); setSearch(""); setOpen(false); }}
                className="cursor-pointer"
              >
                <Check className={cn("mr-2 h-4 w-4", value === autoValue ? "opacity-100" : "opacity-0")} />
                {autoLabel}
              </CommandItem>
            )}
            {options
              .filter((o) => o.toLowerCase().includes(trimmed.toLowerCase()))
              .map((o) => (
                <CommandItem
                  key={o}
                  value={o}
                  onSelect={() => { onValueChange(o); setSearch(""); setOpen(false); }}
                  className="cursor-pointer"
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o ? "opacity-100" : "opacity-0")} />
                  {fmt(o)}
                </CommandItem>
              ))}
            {trimmed && (
              <CommandItem
                value={`__custom__${trimmed}`}
                onSelect={() => { onValueChange(trimmed); setSearch(""); setOpen(false); }}
                className="cursor-pointer border-t"
              >
                Ввести своё: «{trimmed}»
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
