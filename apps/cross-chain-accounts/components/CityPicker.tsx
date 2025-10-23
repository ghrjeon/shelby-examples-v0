"use client";

import { City } from "country-state-city";
import { useState, useMemo } from "react";

interface CityPickerProps {
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
}

export const CityPicker = ({ value, onChange, placeholder = "Search cities..." }: CityPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Get all cities and format them
  const allCities = useMemo(() => {
    const cities = City.getAllCities();
    return cities.map((city) => ({
      name: city.name,
      country: city.countryCode,
      state: city.stateCode,
      displayName: `${city.name}, ${city.stateCode ? `${city.stateCode}, ` : ""}${city.countryCode}`,
    }));
  }, []);

  // Filter cities based on search term
  const filteredCities = useMemo(() => {
    if (!searchTerm) return allCities.slice(0, 100); // Show first 100 cities
    
    const lowerSearch = searchTerm.toLowerCase();
    return allCities
      .filter((city) => 
        city.name.toLowerCase().includes(lowerSearch) ||
        city.country.toLowerCase().includes(lowerSearch)
      )
      .slice(0, 100); // Limit to 100 results for performance
  }, [searchTerm, allCities]);

  const handleSelect = (cityName: string) => {
    onChange(cityName);
    setSearchTerm("");
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={isOpen ? searchTerm : value}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {value && !isOpen && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredCities.length > 0 ? (
              filteredCities.map((city, index) => (
                <button
                  key={`${city.name}-${city.country}-${index}`}
                  type="button"
                  onClick={() => handleSelect(city.name)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                >
                  <div className="font-medium">{city.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {city.state && `${city.state}, `}{city.country}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-center text-gray-500 dark:text-gray-400">
                No cities found
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

