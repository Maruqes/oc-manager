import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

type SelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type SelectOptionGroup<T extends string> = {
  label: string;
  options: Array<SelectOption<T>>;
};

type CustomSelectProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: Array<SelectOption<T>>;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
};

type GroupedCustomSelectProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  groups: Array<SelectOptionGroup<T>>;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
};

export function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchable = false,
  className = "",
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = search
    ? options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={`custom-select ${className} ${isOpen ? "custom-select-open" : ""}`}>
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="custom-select-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={`custom-select-chevron ${isOpen ? "rotated" : ""}`} />
      </button>

      {isOpen && (
        <div className="custom-select-dropdown">
          {searchable && (
            <div className="custom-select-search">
              <Search size={14} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="custom-select-options">
            {filteredOptions.length === 0 ? (
              <div className="custom-select-empty">No options found</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`custom-select-option ${option.value === value ? "selected" : ""}`}
                  onClick={() => handleSelect(option.value)}
                >
                  <span className="custom-select-option-content">
                    <span className="custom-select-option-label">{option.label}</span>
                    {option.description && (
                      <span className="custom-select-option-description">{option.description}</span>
                    )}
                  </span>
                  {option.value === value && <Check size={14} className="custom-select-check" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function GroupedCustomSelect<T extends string>({
  value,
  onChange,
  groups,
  placeholder = "Select...",
  searchable = false,
  className = "",
}: GroupedCustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const allOptions = groups.flatMap((g) => g.options);
  const selectedOption = allOptions.find((opt) => opt.value === value);

  const filteredGroups = search
    ? groups
        .map((group) => ({
          ...group,
          options: group.options.filter((opt) =>
            opt.label.toLowerCase().includes(search.toLowerCase()) ||
            group.label.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((group) => group.options.length > 0)
    : groups;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={`custom-select ${className} ${isOpen ? "custom-select-open" : ""}`}>
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="custom-select-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={`custom-select-chevron ${isOpen ? "rotated" : ""}`} />
      </button>

      {isOpen && (
        <div className="custom-select-dropdown">
          {searchable && (
            <div className="custom-select-search">
              <Search size={14} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="custom-select-options">
            {filteredGroups.length === 0 ? (
              <div className="custom-select-empty">No options found</div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.label} className="custom-select-group">
                  <div className="custom-select-group-label">{group.label}</div>
                  {group.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`custom-select-option ${option.value === value ? "selected" : ""}`}
                      onClick={() => handleSelect(option.value)}
                    >
                      <span className="custom-select-option-content">
                        <span className="custom-select-option-label">{option.label}</span>
                        {option.description && (
                          <span className="custom-select-option-description">{option.description}</span>
                        )}
                      </span>
                      {option.value === value && <Check size={14} className="custom-select-check" />}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
