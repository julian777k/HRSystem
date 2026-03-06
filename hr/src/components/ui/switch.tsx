"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  style,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      style={{ height: 14, width: 30, minHeight: 14, minWidth: 30, ...style }}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        style={{ height: 12, width: 12, minHeight: 12, minWidth: 12 }}
        className={cn(
          "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block rounded-full shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-[17px] data-[state=unchecked]:translate-x-[1px]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
