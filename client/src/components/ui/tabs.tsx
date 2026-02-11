import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

// Context for directional slide animation on tab content
const TabsDirectionContext = React.createContext<'left' | 'right' | null>(null);
const TabsTriggerOrderContext = React.createContext<((value: string) => void) | null>(null);

// Context for animated tabs (underline indicator)
const AnimatedTabsContext = React.createContext<{
  registerTab: (value: string, element: HTMLButtonElement | null) => void;
  activeTab: string | undefined;
  indicatorStyle: React.CSSProperties;
} | null>(null);

// Enhanced Tabs root with direction tracking
const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ onValueChange, children, ...props }, ref) => {
  const [direction, setDirection] = React.useState<'left' | 'right' | null>(null);
  const tabOrderRef = React.useRef<string[]>([]);
  const currentValueRef = React.useRef<string | undefined>(
    (props.value as string) ?? (props.defaultValue as string)
  );

  const registerTriggerOrder = React.useCallback((value: string) => {
    if (!tabOrderRef.current.includes(value)) {
      tabOrderRef.current.push(value);
    }
  }, []);

  const handleValueChange = React.useCallback((newValue: string) => {
    const prevValue = currentValueRef.current;
    if (prevValue) {
      const prevIdx = tabOrderRef.current.indexOf(prevValue);
      const newIdx = tabOrderRef.current.indexOf(newValue);
      if (prevIdx !== -1 && newIdx !== -1) {
        setDirection(newIdx > prevIdx ? 'right' : 'left');
      }
    }
    currentValueRef.current = newValue;
    onValueChange?.(newValue);
  }, [onValueChange]);

  // Keep ref in sync with controlled value
  React.useEffect(() => {
    if (props.value !== undefined) {
      currentValueRef.current = props.value as string;
    }
  }, [props.value]);

  return (
    <TabsDirectionContext.Provider value={direction}>
      <TabsTriggerOrderContext.Provider value={registerTriggerOrder}>
        <TabsPrimitive.Root
          ref={ref}
          onValueChange={handleValueChange}
          {...props}
        >
          {children}
        </TabsPrimitive.Root>
      </TabsTriggerOrderContext.Provider>
    </TabsDirectionContext.Provider>
  );
})
Tabs.displayName = "Tabs"

// Animated TabsList with sliding indicator
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: "default" | "underline" }
>(({ className, variant = "default", children, ...props }, ref) => {
  const [tabElements, setTabElements] = React.useState<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>({});
  const [activeTab, setActiveTab] = React.useState<string | undefined>(undefined);
  const listRef = React.useRef<HTMLDivElement>(null);

  const registerTab = React.useCallback((value: string, element: HTMLButtonElement | null) => {
    setTabElements(prev => {
      const next = new Map(prev);
      if (element) {
        next.set(value, element);
      } else {
        next.delete(value);
      }
      return next;
    });
  }, []);

  // Update indicator position when active tab changes
  React.useEffect(() => {
    if (variant !== "underline") return;

    const list = listRef.current;
    if (!list) return;

    const updateIndicator = () => {
      const activeElement = list.querySelector('[data-state="active"]') as HTMLButtonElement;
      if (activeElement && list) {
        const listRect = list.getBoundingClientRect();
        const tabRect = activeElement.getBoundingClientRect();
        setIndicatorStyle({
          width: tabRect.width,
          transform: `translateX(${tabRect.left - listRect.left}px)`,
        });
        setActiveTab(activeElement.getAttribute('data-value') || undefined);
      }
    };

    // Initial update
    updateIndicator();

    // Watch for changes - observe data-state, content changes (badge counts), and DOM additions/removals
    const observer = new MutationObserver(updateIndicator);
    observer.observe(list, { attributes: true, childList: true, subtree: true, characterData: true });

    // Also update on resize
    window.addEventListener('resize', updateIndicator);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [variant, tabElements]);

  const combinedRef = React.useCallback(
    (node: HTMLDivElement) => {
      (listRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
  );

  if (variant === "underline") {
    return (
      <AnimatedTabsContext.Provider value={{ registerTab, activeTab, indicatorStyle }}>
        <TabsPrimitive.List
          ref={combinedRef}
          className={cn(
            "relative flex h-11 items-center gap-1 border-b border-border/50 bg-transparent p-0 text-muted-foreground overflow-x-auto scrollbar-hide flex-nowrap",
            className
          )}
          style={{ WebkitOverflowScrolling: 'touch' }}
          {...props}
        >
          {children}
          {/* Animated indicator */}
          <span
            className="absolute bottom-0 h-0.5 bg-primary rounded-full transition-all duration-300 ease-out"
            style={indicatorStyle}
          />
        </TabsPrimitive.List>
      </AnimatedTabsContext.Provider>
    );
  }

  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "flex h-11 items-center gap-1 rounded-xl bg-muted/50 p-1.5 text-muted-foreground overflow-x-auto scrollbar-hide flex-nowrap w-fit",
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  );
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { variant?: "default" | "underline" }
>(({ className, variant = "default", value, ...props }, ref) => {
  const context = React.useContext(AnimatedTabsContext);
  const registerOrder = React.useContext(TabsTriggerOrderContext);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const registerTab = context?.registerTab;

  React.useEffect(() => {
    if (registerTab && value) {
      registerTab(value, triggerRef.current);
      return () => registerTab(value, null);
    }
  }, [registerTab, value]);

  // Register trigger order for directional content animation
  React.useEffect(() => {
    if (registerOrder && value) {
      registerOrder(value);
    }
  }, [registerOrder, value]);

  const combinedRef = React.useCallback(
    (node: HTMLButtonElement) => {
      (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
  );

  // For underline variant with animated indicator, don't show the pseudo-element underline
  const isAnimatedUnderline = variant === "underline" && context;

  return (
    <TabsPrimitive.Trigger
      ref={combinedRef}
      value={value}
      data-value={value}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variant === "underline"
          ? cn(
              "relative px-4 py-2.5 text-muted-foreground hover:text-foreground data-[state=active]:text-foreground",
              // Only show pseudo-element underline if not using animated version
              !isAnimatedUnderline && "data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary data-[state=active]:after:rounded-full"
            )
          : "rounded-lg px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/50",
        className
      )}
      {...props}
    />
  );
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => {
  const direction = React.useContext(TabsDirectionContext);

  return (
    <TabsPrimitive.Content
      ref={ref}
      forceMount
      className={cn(
        "mt-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "data-[state=inactive]:hidden",
        "data-[state=active]:animate-in data-[state=active]:duration-500 data-[state=active]:ease-out",
        direction === 'right'
          ? 'data-[state=active]:slide-in-from-right-8'
          : direction === 'left'
            ? 'data-[state=active]:slide-in-from-left-8'
            : 'data-[state=active]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  );
})
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
