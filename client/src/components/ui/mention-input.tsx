import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: number;
  userId: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface MentionData {
  userId: number;
  name: string;
  startIndex: number;
  endIndex: number;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string, mentions: MentionData[]) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
}

export function MentionInput({
  value,
  onChange,
  placeholder = "Write a note... Use @ to mention teammates",
  className,
  rows = 3,
  disabled = false,
}: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch team members
  const { data: membersData } = useQuery<{ members: TeamMember[] }>({
    queryKey: ["/api/crm/members"],
  });
  const members = membersData?.members || [];

  // Filter members based on search query
  const filteredMembers = members.filter((member) => {
    const fullName = `${member.firstName || ""} ${member.lastName || ""}`.toLowerCase();
    const email = member.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  // Get display name for a member
  const getMemberName = (member: TeamMember) => {
    if (member.firstName || member.lastName) {
      return `${member.firstName || ""} ${member.lastName || ""}`.trim();
    }
    return member.email.split("@")[0];
  };

  // Handle text change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    // Check if we should show the dropdown
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's no space after @ (user is still typing the mention)
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setShowDropdown(true);
        setSearchQuery(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        setSelectedIndex(0);

        // Calculate dropdown position
        if (textareaRef.current) {
          const textarea = textareaRef.current;
          const { top, left } = getCaretCoordinates(textarea, lastAtIndex);
          setDropdownPosition({
            top: top + 24, // Below the caret
            left: Math.min(left, textarea.offsetWidth - 200), // Prevent overflow
          });
        }
      } else {
        setShowDropdown(false);
      }
    } else {
      setShowDropdown(false);
    }

    // Parse existing mentions from the text
    const mentions = parseMentions(newValue);
    onChange(newValue, mentions);
  };

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || filteredMembers.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredMembers.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        break;
      case "Enter":
      case "Tab":
        e.preventDefault();
        selectMember(filteredMembers[selectedIndex]);
        break;
      case "Escape":
        setShowDropdown(false);
        break;
    }
  };

  // Select a member from the dropdown
  const selectMember = (member: TeamMember) => {
    if (mentionStartIndex === null || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const name = getMemberName(member);
    const mentionText = `@${name}`;

    // Replace the @query with the full mention
    const beforeMention = value.substring(0, mentionStartIndex);
    const afterMention = value.substring(textarea.selectionStart);
    const newValue = beforeMention + mentionText + " " + afterMention;

    // Parse mentions from the new value
    const mentions = parseMentions(newValue);

    // Add this mention with user ID
    mentions.push({
      userId: member.userId,
      name: name,
      startIndex: mentionStartIndex,
      endIndex: mentionStartIndex + mentionText.length,
    });

    onChange(newValue, mentions);
    setShowDropdown(false);
    setSearchQuery("");
    setMentionStartIndex(null);

    // Move cursor after the mention
    setTimeout(() => {
      const newCursorPos = mentionStartIndex + mentionText.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  // Parse mentions from text (looks for @FirstName LastName patterns)
  const parseMentions = (text: string): MentionData[] => {
    const mentions: MentionData[] = [];
    const mentionRegex = /@([A-Za-z]+(?:\s[A-Za-z]+)?)/g;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const name = match[1];
      // Try to find a matching member
      const member = members.find((m) => {
        const fullName = `${m.firstName || ""} ${m.lastName || ""}`.trim();
        return fullName.toLowerCase() === name.toLowerCase();
      });

      if (member) {
        mentions.push({
          userId: member.userId,
          name: name,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    return mentions;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn("resize-none", className)}
        rows={rows}
        disabled={disabled}
      />

      {/* Mention Dropdown */}
      {showDropdown && filteredMembers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 bg-white rounded-md border shadow-lg max-h-48 overflow-y-auto min-w-[200px]"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
        >
          {filteredMembers.slice(0, 5).map((member, index) => (
            <button
              key={member.userId}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex flex-col",
                index === selectedIndex && "bg-blue-50"
              )}
              onClick={() => selectMember(member)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="font-medium text-gray-900">{getMemberName(member)}</span>
              <span className="text-xs text-gray-500">{member.email}</span>
            </button>
          ))}
        </div>
      )}

      {showDropdown && filteredMembers.length === 0 && searchQuery && (
        <div
          ref={dropdownRef}
          className="absolute z-50 bg-white rounded-md border shadow-lg p-3 text-sm text-gray-500"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
        >
          No teammates found
        </div>
      )}
    </div>
  );
}

// Helper function to get caret coordinates in textarea
function getCaretCoordinates(
  element: HTMLTextAreaElement,
  position: number
): { top: number; left: number } {
  const div = document.createElement("div");
  const style = getComputedStyle(element);

  // Copy styles that affect text layout
  const properties = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "wordWrap",
    "whiteSpace",
    "borderLeftWidth",
    "borderTopWidth",
    "paddingLeft",
    "paddingTop",
    "lineHeight",
  ];

  properties.forEach((prop) => {
    div.style[prop as any] = style[prop as any];
  });

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.width = `${element.offsetWidth}px`;

  const text = element.value.substring(0, position);
  div.textContent = text;

  const span = document.createElement("span");
  span.textContent = element.value.substring(position) || ".";
  div.appendChild(span);

  document.body.appendChild(div);

  const { offsetTop, offsetLeft } = span;
  document.body.removeChild(div);

  return {
    top: offsetTop + parseInt(style.paddingTop) + parseInt(style.borderTopWidth),
    left: offsetLeft + parseInt(style.paddingLeft) + parseInt(style.borderLeftWidth),
  };
}

// Export helper to extract mention user IDs from text
export function extractMentionUserIds(text: string, members: TeamMember[]): number[] {
  const mentionRegex = /@([A-Za-z]+(?:\s[A-Za-z]+)?)/g;
  const userIds: number[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const name = match[1];
    const member = members.find((m) => {
      const fullName = `${m.firstName || ""} ${m.lastName || ""}`.trim();
      return fullName.toLowerCase() === name.toLowerCase();
    });

    if (member && !userIds.includes(member.userId)) {
      userIds.push(member.userId);
    }
  }

  return userIds;
}

// Export helper to highlight mentions in text
export function highlightMentions(text: string): React.ReactNode {
  const mentionRegex = /@([A-Za-z]+(?:\s[A-Za-z]+)?)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add the mention with styling
    parts.push(
      <span key={match.index} className="text-blue-600 font-medium">
        {match[0]}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
