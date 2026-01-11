import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useMemo } from "react";

interface FieldConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  isCustomField?: boolean;
}

type SectionZone = "main" | "sidebar";

interface SectionConfig {
  id: string;
  title: string;
  visible: boolean;
  collapsed: boolean;
  order: number;
  fields: FieldConfig[];
  zone?: SectionZone;
  supportsCustomFields?: boolean;
}

interface CustomField {
  id: number;
  name: string;
  label: string;
  fieldType: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  isRequired?: boolean;
  sectionPlacement?: string;
}

interface LayoutData {
  layout: SectionConfig[] | null;
  customFields: CustomField[];
}

// Default section orders by zone (when no custom layout exists)
const DEFAULT_SECTION_CONFIG: Record<string, { main: string[]; sidebar: string[] }> = {
  deal: {
    main: [], // Tabs are fixed, no reorderable main sections
    sidebar: ["key-people", "deal-details", "quick-actions"],
  },
  contact: {
    main: ["contact-info", "engagement-history", "email-activity", "tasks"],
    sidebar: ["associated-deals", "quick-info"],
  },
  company: {
    main: ["company-info", "associated-contacts", "tasks"],
    sidebar: ["deals"],
  },
};

export function useDetailPageLayout(objectType: "deal" | "contact" | "company") {
  const { data: layoutData, isLoading } = useQuery<LayoutData>({
    queryKey: ["/api/crm/layouts", objectType],
    queryFn: () =>
      apiRequest("GET", `/api/crm/layouts/${objectType}`).then((res) =>
        res.json()
      ),
  });

  // Process the layout data
  const processedLayout = useMemo(() => {
    const sections = layoutData?.layout || null;
    const customFields = layoutData?.customFields || [];

    // Create a map for quick lookup
    const sectionMap = new Map<string, SectionConfig>();
    const fieldVisibilityMap = new Map<string, boolean>();

    if (sections) {
      sections.forEach((section) => {
        sectionMap.set(section.id, section);
        section.fields.forEach((field) => {
          fieldVisibilityMap.set(`${section.id}:${field.id}`, field.visible);
        });
      });
    }

    return {
      sections,
      sectionMap,
      fieldVisibilityMap,
      customFields,
    };
  }, [layoutData]);

  // Check if a section is visible
  const isSectionVisible = (sectionId: string): boolean => {
    const { sectionMap } = processedLayout;
    if (!sectionMap.size) return true; // Default to visible if no custom layout
    const section = sectionMap.get(sectionId);
    return section?.visible ?? true;
  };

  // Check if a field is visible
  const isFieldVisible = (sectionId: string, fieldId: string): boolean => {
    const { fieldVisibilityMap, sectionMap } = processedLayout;
    if (!sectionMap.size) return true; // Default to visible if no custom layout
    return fieldVisibilityMap.get(`${sectionId}:${fieldId}`) ?? true;
  };

  // Get section order
  const getSectionOrder = (sectionId: string): number => {
    const { sectionMap } = processedLayout;
    if (!sectionMap.size) {
      // Default ordering based on position in default config
      const config = DEFAULT_SECTION_CONFIG[objectType];
      const mainIndex = config.main.indexOf(sectionId);
      if (mainIndex >= 0) return mainIndex;
      const sidebarIndex = config.sidebar.indexOf(sectionId);
      if (sidebarIndex >= 0) return sidebarIndex;
      return 99;
    }
    const section = sectionMap.get(sectionId);
    return section?.order ?? 99;
  };

  // Get all visible sections sorted by order
  const getVisibleSections = (): SectionConfig[] => {
    const { sections } = processedLayout;
    if (!sections) return [];
    return sections
      .filter((s) => s.visible)
      .sort((a, b) => a.order - b.order);
  };

  // Get visible sections for a specific zone
  const getSectionsForZone = (zone: SectionZone): SectionConfig[] => {
    const { sections } = processedLayout;
    if (!sections) {
      // Return default order for the zone
      const sectionIds = DEFAULT_SECTION_CONFIG[objectType][zone];
      return sectionIds.map((id, index) => ({
        id,
        title: id,
        visible: true,
        collapsed: false,
        order: index,
        fields: [],
        zone,
      }));
    }
    return sections
      .filter((s) => s.zone === zone && s.visible)
      .sort((a, b) => a.order - b.order);
  };

  // Get custom fields for a specific section
  const getCustomFieldsForSection = (sectionId: string): CustomField[] => {
    const { customFields, sectionMap, fieldVisibilityMap } = processedLayout;
    const section = sectionMap.get(sectionId);

    // If no custom layout or section doesn't support custom fields, return empty
    if (!section?.supportsCustomFields) return [];

    // Get custom fields that are in this section and visible
    return customFields.filter((cf) => {
      const fieldId = `custom_${cf.name}`;
      // Check if the field is visible in this section
      const isVisible = fieldVisibilityMap.get(`${sectionId}:${fieldId}`);
      return isVisible !== false; // Default to visible if not explicitly set
    });
  };

  // Get visible custom fields (legacy - for backward compatibility)
  const getVisibleCustomFields = (): CustomField[] => {
    const { customFields, sectionMap, fieldVisibilityMap } = processedLayout;

    // If no custom layout, all custom fields are visible
    if (!sectionMap.size) return customFields;

    // Check visibility across all sections
    return customFields.filter((cf) => {
      const fieldId = `custom_${cf.name}`;
      // Check all sections for this field's visibility
      const entries = Array.from(fieldVisibilityMap.entries());
      for (let i = 0; i < entries.length; i++) {
        const [key, visible] = entries[i];
        if (key.endsWith(`:${fieldId}`) && visible === false) {
          return false;
        }
      }
      return true;
    });
  };

  // Get section config
  const getSection = (sectionId: string): SectionConfig | undefined => {
    return processedLayout.sectionMap.get(sectionId);
  };

  // Get visible fields for a section, sorted by order
  const getVisibleFields = (sectionId: string): FieldConfig[] => {
    const section = processedLayout.sectionMap.get(sectionId);
    if (!section) return [];
    return section.fields
      .filter((f) => f.visible)
      .sort((a, b) => a.order - b.order);
  };

  return {
    isLoading,
    hasCustomLayout: !!processedLayout.sections,
    customFields: processedLayout.customFields,
    isSectionVisible,
    isFieldVisible,
    getSectionOrder,
    getVisibleSections,
    getSectionsForZone,
    getCustomFieldsForSection,
    getVisibleCustomFields,
    getSection,
    getVisibleFields,
  };
}
