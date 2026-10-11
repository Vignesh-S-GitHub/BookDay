/** Original scenic illustrations for all 28 states and 8 Union Territories. */
const places = {
  "Tamil Nadu": ["home_india", "Ancient temples · Coast · Hill stations"],
  Kerala: ["kerala_backwaters", "Backwaters · Beaches · Hill stations"],
  Goa: ["goa_coast", "Beaches · Coastal heritage · Tropical stays"],
  Rajasthan: ["jaipur_palace", "Palaces · Forts · Desert landscapes"],
  "Uttar Pradesh": ["agra_taj", "Taj Mahal · Historic cities · Sacred rivers"],
  "Andhra Pradesh": ["andhra_coast", "Temple heritage · Eastern Ghats · Coast"],
  "Arunachal Pradesh": [
    "arunachal_mountains",
    "Monasteries · Mountains · Forests",
  ],
  Assam: ["assam_river", "Brahmaputra · Tea gardens · River journeys"],
  Bihar: ["bihar_bodhgaya", "Bodh Gaya · Ancient heritage · Pilgrimage"],
  Chhattisgarh: ["chhattisgarh_falls", "Waterfalls · Forests · Heritage"],
  Gujarat: ["gujarat_rann", "Salt desert · Heritage · Coast"],
  Haryana: ["haryana_gardens", "Historic gardens · Heritage · Countryside"],
  "Himachal Pradesh": [
    "himachal_valley",
    "Mountain valleys · Forests · Hill stations",
  ],
  Jharkhand: ["jharkhand_falls", "Waterfalls · Forests · Hills"],
  Karnataka: ["karnataka_hampi", "Hampi · Heritage · Hill stations"],
  "Madhya Pradesh": ["madhya_sanchi", "Sanchi · Heritage · Forests"],
  Maharashtra: ["maharashtra_mumbai", "Mumbai · Forts · Western Ghats"],
  Manipur: ["manipur_lake", "Loktak Lake · Hills · Culture"],
  Meghalaya: ["meghalaya_bridge", "Living root bridges · Forests · Waterfalls"],
  Mizoram: ["mizoram_hills", "Highland hills · Aizawl · Forests"],
  Nagaland: ["nagaland_valley", "Dzukou Valley · Hills · Culture"],
  Odisha: ["odisha_konark", "Konark · Temples · Coast"],
  Punjab: ["punjab_amritsar", "Amritsar · Sacred heritage · Culture"],
  Sikkim: ["sikkim_mountains", "Monasteries · Himalayan views · Mountains"],
  Telangana: ["telangana_hyderabad", "Hyderabad · Heritage · Historic cities"],
  Tripura: ["tripura_palace", "Palaces · Lakes · Heritage"],
  Uttarakhand: [
    "uttarakhand_river",
    "Ganges · Himalayan foothills · Pilgrimage",
  ],
  "West Bengal": ["bengal_kolkata", "Kolkata · Heritage · Himalayan foothills"],
  "Andaman and Nicobar Islands": [
    "andaman_beach",
    "Island beaches · Tropical forest · Lagoons",
  ],
  Chandigarh: ["chandigarh_lake", "Sukhna Lake · Gardens · City stays"],
  "Dadra and Nagar Haveli and Daman and Diu": [
    "daman_diu",
    "Coastal forts · Beaches · Heritage",
  ],
  Delhi: ["delhi_gate", "India Gate · Historic monuments · City stays"],
  "Jammu and Kashmir": [
    "kashmir_lake",
    "Dal Lake · Houseboats · Mountain valleys",
  ],
  Ladakh: ["ladakh_monastery", "Monasteries · High mountains · Valleys"],
  Lakshadweep: [
    "lakshadweep_lagoon",
    "Coral islands · Lagoons · Tropical beaches",
  ],
  Puducherry: ["puducherry_coast", "French Quarter · Seafront · Heritage"],
};
export const destinations = Object.fromEntries(
  Object.entries(places).map(([state, [image, subtitle]]) => [
    state,
    { image, subtitle },
  ]),
);
