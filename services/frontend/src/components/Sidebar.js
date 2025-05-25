import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Message as MessageIcon,
  Settings as SettingsIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Chat', icon: <ChatIcon />, path: '/chat' },
  { text: 'Messages', icon: <MessageIcon />, path: '/messages' },
  { text: 'Users', icon: <PeopleIcon />, path: '/users' },
  { text: 'Storage', icon: <StorageIcon />, path: '/storage' },
  { text: 'Security', icon: <SecurityIcon />, path: '/security' },
  { text: 'Notifications', icon: <NotificationsIcon />, path: '/notifications' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path) => {
    navigate(path);
    if (window.innerWidth < 600) {
      onClose();
    }
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid rgba(0, 0, 0, 0.12)',
        },
      }}
    >
      <Box sx={{ overflow: 'auto', mt: '64px' }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" noWrap component="div">
            Navigation
          </Typography>
        </Box>
        <Divider />
        <List>
          {menuItems.map((item) => (
            <ListItem
              button
              key={item.text}
              onClick={() => handleNavigation(item.path)}
              selected={location.pathname === item.path}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'primary.light',
                  '&:hover': {
                    backgroundColor: 'primary.light',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path ? 'primary.main' : 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  color: location.pathname === item.path ? 'primary.main' : 'inherit',
                }}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}

export default Sidebar; 