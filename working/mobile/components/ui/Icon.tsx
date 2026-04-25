import React from 'react';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../lib/constants';

type IconLibrary = 'ionicons' | 'material' | 'material-community';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  library?: IconLibrary;
}

export function Icon({ name, size = 24, color = COLORS.textPrimary, library = 'ionicons' }: IconProps) {
  switch (library) {
    case 'material':
      return <MaterialIcons name={name as any} size={size} color={color} />;
    case 'material-community':
      return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
    case 'ionicons':
    default:
      return <Ionicons name={name as any} size={size} color={color} />;
  }
}

// Icon name mappings for common use cases
export const IconNames = {
  // Camera & Media
  camera: 'camera',
  cameraOutline: 'camera-outline',
  image: 'image',
  imageOutline: 'image-outline',
  images: 'images',
  imagesOutline: 'images-outline',
  
  // Fish & Marine
  fish: 'fish',
  fishOutline: 'fish-outline',
  
  // Navigation
  home: 'home',
  homeOutline: 'home-outline',
  map: 'map',
  mapOutline: 'map-outline',
  location: 'location',
  locationOutline: 'location-outline',
  
  // User & Profile
  person: 'person',
  personOutline: 'person-outline',
  people: 'people',
  peopleOutline: 'people-outline',
  
  // Actions
  settings: 'settings',
  settingsOutline: 'settings-outline',
  notifications: 'notifications',
  notificationsOutline: 'notifications-outline',
  search: 'search',
  searchOutline: 'search-outline',
  
  // Status
  checkmark: 'checkmark',
  checkmarkCircle: 'checkmark-circle',
  close: 'close',
  closeCircle: 'close-circle',
  warning: 'warning',
  warningOutline: 'warning-outline',
  alert: 'alert-circle',
  alertOutline: 'alert-circle-outline',
  information: 'information-circle',
  informationOutline: 'information-circle-outline',
  
  // Charts & Analytics
  stats: 'stats-chart',
  statsOutline: 'stats-chart-outline',
  barChart: 'bar-chart',
  barChartOutline: 'bar-chart-outline',
  pieChart: 'pie-chart',
  pieChartOutline: 'pie-chart-outline',
  
  // Weather & Nature
  water: 'water',
  waterOutline: 'water-outline',
  rainy: 'rainy',
  rainyOutline: 'rainy-outline',
  cloudy: 'cloudy',
  cloudyOutline: 'cloudy-outline',
  sunny: 'sunny',
  sunnyOutline: 'sunny-outline',
  
  // Communication
  chatbubble: 'chatbubble',
  chatbubbleOutline: 'chatbubble-outline',
  chatbubbles: 'chatbubbles',
  chatbubblesOutline: 'chatbubbles-outline',
  
  // Documents
  document: 'document',
  documentOutline: 'document-outline',
  documentText: 'document-text',
  documentTextOutline: 'document-text-outline',
  
  // Other
  star: 'star',
  starOutline: 'star-outline',
  trophy: 'trophy',
  trophyOutline: 'trophy-outline',
  calendar: 'calendar',
  calendarOutline: 'calendar-outline',
  time: 'time',
  timeOutline: 'time-outline',
  download: 'download',
  downloadOutline: 'download-outline',
  share: 'share',
  shareOutline: 'share-outline',
  trash: 'trash',
  trashOutline: 'trash-outline',
  edit: 'create',
  editOutline: 'create-outline',
} as const;
