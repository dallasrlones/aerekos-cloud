import React, { createContext, useState, useEffect, useContext } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { projectService } from '../services/projectService';
import { useAuth } from './AuthContext';
import { parseProjectConfig } from '../utils/environmentMatch';
import { visibleProjects } from '../config/retiredProjects';

const ProjectContext = createContext(null);

const CURRENT_PROJECT_KEY = '@aerekos_current_project_id';
const PROJECTS_KEY = '@aerekos_projects_cache';
const CURRENT_ENV_KEY = '@aerekos_current_environment';
const SYSTEM_PROJECT_ID = '9d8bde11-6933-4732-b746-602dcf72eaa5';

export const ProjectProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [currentProject, setCurrentProjectState] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentEnvironment, setCurrentEnvironmentState] = useState('dev');
  const [environments, setEnvironments] = useState([]);

  // Load projects and current project on mount, but only if authenticated
  // Wait for auth to finish loading before checking authentication status
  useEffect(() => {
    // Don't do anything while auth is still loading
    if (authLoading) {
      return;
    }
    
    if (isAuthenticated) {
      loadProjects();
    } else {
      // Reset state when not authenticated
      setProjects([]);
      setCurrentProjectState(null);
      setLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  /**
   * Load all projects from API
   */
  const loadProjects = async () => {
    // Don't load projects if not authenticated
    if (!isAuthenticated || authLoading) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await projectService.getProjects();
      
      if (result.success) {
        const loadedProjects = visibleProjects(result.projects || []);
        setProjects(loadedProjects);
        
        // Cache projects
        await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(loadedProjects));
        
        // If no current project set, auto-set first project
        const storedProjectId = await AsyncStorage.getItem(CURRENT_PROJECT_KEY);
        if (!storedProjectId && loadedProjects.length > 0) {
          await setCurrentProject(loadedProjects[0].id);
        } else if (storedProjectId) {
          // Verify stored project still exists
          const project = loadedProjects.find(p => p.id === storedProjectId);
          if (project) {
            setCurrentProjectState(project);
            await loadEnvironments(project, { fromSwitch: false });
          } else {
            // Stored project doesn't exist, set first project
            if (loadedProjects.length > 0) {
              await setCurrentProject(loadedProjects[0].id);
            }
          }
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
      setError(err.message || 'Failed to load projects');
      
      // Try to load from cache
      try {
        const cached = await AsyncStorage.getItem(PROJECTS_KEY);
        if (cached) {
          const cachedProjects = visibleProjects(JSON.parse(cached));
          setProjects(cachedProjects);
        }
      } catch (cacheErr) {
        console.error('Error loading cached projects:', cacheErr);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Set current project (with loading state and persistence)
   */
  const setCurrentProject = async (projectId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Find project in current list
      let project = projects.find(p => p.id === projectId);
      
      // If not found, fetch it
      if (!project) {
        const result = await projectService.getProject(projectId);
        if (result.success) {
          project = result.project;
          // Add to projects list if not already there
          if (!projects.find(p => p.id === projectId)) {
            setProjects([...projects, project]);
          }
        } else {
          throw new Error(result.error || 'Project not found');
        }
      }
      
      // Set current project
      setCurrentProjectState(project);
      await loadEnvironments(project, { fromSwitch: true });
      
      // Persist to storage
      await AsyncStorage.setItem(CURRENT_PROJECT_KEY, projectId);
      
      return { success: true };
    } catch (err) {
      console.error('Error setting current project:', err);
      setError(err.message || 'Failed to set current project');
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const loadEnvironments = async (project, { fromSwitch = false } = {}) => {
    if (!project?.id) {
      setEnvironments([]);
      setCurrentEnvironmentState('dev');
      return;
    }
    const system = project.id === SYSTEM_PROJECT_ID || String(project.name || '').toLowerCase() === 'system';
    const defaultEnv = String(parseProjectConfig(project).default_environment || '').trim()
      || (system ? 'prod' : 'dev');
    try {
      const list = await projectService.listEnvironments(project.id);
      setEnvironments(list);
      if (system) {
        setCurrentEnvironmentState('prod');
        await AsyncStorage.setItem(CURRENT_ENV_KEY, 'prod');
        return;
      }
      let next;
      if (fromSwitch) {
        next = list.find((e) => e.name === defaultEnv)?.name || list[0]?.name || defaultEnv;
      } else {
        const stored = await AsyncStorage.getItem(CURRENT_ENV_KEY);
        next = list.find((e) => e.name === stored)?.name
          || list.find((e) => e.name === defaultEnv)?.name
          || list[0]?.name
          || defaultEnv;
      }
      setCurrentEnvironmentState(next);
      await AsyncStorage.setItem(CURRENT_ENV_KEY, next);
    } catch {
      setEnvironments([{ name: defaultEnv, git_ref: defaultEnv === 'prod' ? 'main' : 'develop', protected: defaultEnv === 'prod' }]);
      setCurrentEnvironmentState(defaultEnv);
    }
  };

  const setCurrentEnvironment = async (name) => {
    const env = String(name || 'dev');
    setCurrentEnvironmentState(env);
    await AsyncStorage.setItem(CURRENT_ENV_KEY, env);
  };

  const refreshEnvironments = async () => {
    if (currentProject) await loadEnvironments(currentProject, { fromSwitch: false });
  };

  /**
   * Get current project
   */
  const getCurrentProject = () => {
    return currentProject;
  };

  /**
   * Refresh projects list
   */
  const refreshProjects = async () => {
    await loadProjects();
  };

  /**
   * Create new project and optionally set as current
   */
  const createProject = async (projectData, setAsCurrent = true) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await projectService.createProject(projectData);
      
      if (result.success) {
        const newProject = result.project;
        
        // Add to projects list
        setProjects([...projects, newProject]);
        
        // Cache projects
        await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify([...projects, newProject]));
        
        // If first project or setAsCurrent is true, set as current
        if (result.isFirst || setAsCurrent) {
          await setCurrentProject(newProject.id);
        }
        
        return { success: true, project: newProject, isFirst: result.isFirst };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Error creating project:', err);
      setError(err.message || 'Failed to create project');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update project
   */
  const updateProject = async (projectId, projectData) => {
    setError(null);
    
    try {
      const result = await projectService.updateProject(projectId, projectData);
      
      if (result.success) {
        // Update in projects list
        const updatedProjects = projects.map(p => 
          p.id === projectId ? { ...p, ...result.project } : p
        );
        setProjects(updatedProjects);
        
        // Update cache
        await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(updatedProjects));
        
        // Update current project if it's the one being updated
        if (currentProject && currentProject.id === projectId) {
          setCurrentProjectState({ ...currentProject, ...result.project });
        }
        
        return { success: true, project: result.project };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Error updating project:', err);
      setError(err.message || 'Failed to update project');
      return { success: false, error: err.message };
    }
  };

  /**
   * Delete project
   */
  const deleteProject = async (projectId) => {
    setError(null);
    
    try {
      const result = await projectService.deleteProject(projectId);
      
      if (result.success) {
        // Remove from projects list
        const updatedProjects = projects.filter(p => p.id !== projectId);
        setProjects(updatedProjects);
        
        // Update cache
        await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(updatedProjects));
        
        // If deleted project was current, set first project as current
        if (currentProject && currentProject.id === projectId) {
          if (updatedProjects.length > 0) {
            await setCurrentProject(updatedProjects[0].id);
          } else {
            setCurrentProjectState(null);
            await AsyncStorage.removeItem(CURRENT_PROJECT_KEY);
          }
        }
        
        return { success: true, ...result };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      setError(err.message || 'Failed to delete project');
      return { success: false, error: err.message };
    }
  };

  const value = {
    currentProject,
    currentEnvironment,
    environments,
    setCurrentEnvironment,
    refreshEnvironments,
    isSystemProject: currentProject?.id === SYSTEM_PROJECT_ID || String(currentProject?.name || '').toLowerCase() === 'system',
    projects,
    loading,
    isLoading,
    error,
    setCurrentProject,
    getCurrentProject,
    refreshProjects,
    createProject,
    updateProject,
    deleteProject,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider');
  }
  return context;
};
