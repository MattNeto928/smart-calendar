import { createStackNavigator } from '@react-navigation/stack';
import CalendarScreen from '../screens/CalendarScreen';
import EventFormScreen from '../screens/EventFormScreen';
import EventScreen from '../screens/EventScreen';
import EventListScreen from '../screens/EventListScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Calendar">
      <Stack.Screen 
        name="Calendar" 
        component={CalendarScreen} 
        options={{ headerShown: false }} // Hide default header to use custom Navbar
      />
      <Stack.Screen 
        name="EventForm" 
        component={EventFormScreen} 
        options={{ title: 'Add Event' }}
      />
      <Stack.Screen 
        name="EventScreen" 
        component={EventScreen} 
        options={{ title: 'Event Details' }}
      />
      <Stack.Screen 
        name="EventListScreen" 
        component={EventListScreen} 
        options={{ title: 'Parsed Events', headerShown: false }}
      />
    </Stack.Navigator>
  );
}
