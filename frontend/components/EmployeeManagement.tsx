import React, { useEffect, useMemo, useState } from 'react';
import GlassCard from './GlassCard';
import { Employee, EmployeeStatus, Asset, Location, Department, EmployeePersonalInfo, EmployeeOfficialInfo } from '../types';
import { UserPlus, Search, Mail, MapPin, Briefcase, Building, X, Pencil, Trash2, Loader, AlertTriangle, Eye, Package, UserCircle, User, CheckCircle, ArrowLeft, ArrowRight, MessageSquare, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog, { DialogType } from './ConfirmDialog';
import ModalPortal from './ModalPortal';
import { isAdmin } from '../services/permissionUtil';
import { getEmployeesPage } from '../services/dataService';

interface EmployeeManagementProps {
  employees: Employee[];
  assets: Asset[];
  locations: Location[];
  departments: Department[];
  onAdd: (employee: Omit<Employee, 'id'>) => Promise<void>;
  onUpdate: (employee: Employee) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  useBackend?: boolean;
  currentUser?: any; // Add current user for authentication
}

interface EmployeeFormData {
  // Step 1: Basic Info
  employeeId: string;
  locationId?: string;
  status: EmployeeStatus;
  
  // Step 2: Personal Info
  personalInfo: {
    firstName: string;
    lastName?: string;
    gender?: string;
    mobileNumber?: string;
    emergencyContactName?: string;
    emergencyContactNumber?: string;
    personalEmail?: string;
    linkedinUrl?: string;
    additionalComments?: string;
  };
  
  // Step 3: Official Info
  officialInfo: {
    department?: string; // Maps to division in DB
    biometricId?: string;
    rfidSerial?: string;
    agreementSigned: boolean;
    startDate?: string;
    officialDob?: string;
    officialEmail?: string;
  };
}

const initialFormData: EmployeeFormData = {
  employeeId: '',
  status: EmployeeStatus.ACTIVE,
  personalInfo: {
    firstName: '',
    lastName: '',
    gender: '',
    mobileNumber: '',
    emergencyContactName: '',
    emergencyContactNumber: '',
    personalEmail: '',
    linkedinUrl: '',
    additionalComments: ''
  },
  officialInfo: {
    department: '',
    biometricId: '',
    rfidSerial: '',
    agreementSigned: false,
    startDate: '',
    officialDob: '',
    officialEmail: ''
  }
};

const AUDIT_COMMENT_SEPARATOR = '\n---\n';

const splitEmployeeComments = (comments?: string): string[] => {
  if (!comments || comments.trim().length === 0) {
    return [];
  }

  const normalized = comments
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n');
  const blocks = normalized.includes(AUDIT_COMMENT_SEPARATOR)
    ? normalized.split(AUDIT_COMMENT_SEPARATOR)
    : [normalized];

  const entries: string[] = [];
  blocks.forEach((block) => {
    const lines = block
      .split('\n')
      .map(entry => entry.trim())
      .filter(Boolean);

    let buffer: string[] = [];
    lines.forEach((line) => {
      if (line.startsWith('[') && line.includes(']')) {
        if (buffer.length > 0) {
          entries.push(buffer.join('\n'));
          buffer = [];
        }
        entries.push(line);
        return;
      }
      buffer.push(line);
    });

    if (buffer.length > 0) {
      entries.push(buffer.join('\n'));
    }
  });

  return entries.filter(Boolean);
};

const orderEmployeeComments = (comments?: string): string[] => {
  const entries = splitEmployeeComments(comments);
  const withMeta = entries.map((entry, index) => {
    const match = entry.match(/^\[([^\]]+)\]/);
    const timestamp = match ? Date.parse(match[1]) : Number.NaN;
    return { entry, index, timestamp };
  });
  withMeta.sort((a, b) => {
    const aValid = Number.isFinite(a.timestamp);
    const bValid = Number.isFinite(b.timestamp);
    if (aValid && bValid) {
      return b.timestamp - a.timestamp;
    }
    if (aValid) return -1;
    if (bValid) return 1;
    return a.index - b.index;
  });
  return withMeta.map(item => item.entry);
};

const parseEmployeeCommentEntry = (entry: string) => {
  const match = entry.match(/^\[([^\]]+)\]\s*([^:]+):\s*(.*)$/s);
  if (!match) {
    return { timestamp: undefined, author: 'Note', message: entry.trim() };
  }
  return {
    timestamp: match[1]?.trim(),
    author: match[2]?.trim() || 'Note',
    message: match[3]?.trim() || ''
  };
};

const formatCommentTime = (timestamp?: string) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
};

const statusBadge = (status: EmployeeStatus) => {
  const base = 'text-xs px-3 py-1 rounded-full font-semibold';
  return status === EmployeeStatus.ACTIVE
    ? `${base} bg-emerald-100 text-emerald-700`
    : `${base} bg-amber-100 text-amber-700`;
};

const PAGE_SIZE = 20;

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ employees, assets, locations, departments, onAdd, onUpdate, onDelete, canCreate = true, canUpdate = true, canDelete = true, useBackend = false, currentUser }) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [pageEmployees, setPageEmployees] = useState<Employee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData);
  const [fullNameInput, setFullNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employeeIdError, setEmployeeIdError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>(''); // General submission error
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'personal' | 'official' | 'assets'>('overview');
  const [commentText, setCommentText] = useState('');
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: DialogType;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: DialogType.WARNING,
    title: '',
    message: '',
    onConfirm: undefined
  });

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    if (!useBackend) return;
    if (search.trim() !== debouncedSearch) return;

    let isMounted = true;
    const loadEmployeesPage = async () => {
      setIsPageLoading(true);
      setPageError('');
      try {
        const result = await getEmployeesPage({
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch || undefined,
          department: filterDepartment === 'All' ? undefined : filterDepartment
        });
        if (!isMounted) return;
        setPageEmployees([...result.data]);
        setTotalEmployees(result.total);
      } catch (error) {
        if (!isMounted) return;
        console.error('Error loading employees page:', error);
        setPageError('Failed to load employees. Please try again.');
      } finally {
        if (isMounted) {
          setIsPageLoading(false);
        }
      }
    };

    loadEmployeesPage();
    return () => {
      isMounted = false;
    };
  }, [useBackend, page, debouncedSearch, filterDepartment, refreshToken, search]);

  const departmentOptions = useMemo(() => {
    const explicit = departments.map(department => department.name).filter(Boolean);
    if (explicit.length > 0) {
      return Array.from(new Set(explicit)).sort((a, b) => a.localeCompare(b));
    }
    const inferred = employees
      .map(employee => employee.department)
      .filter((department): department is string => !!department);
    return Array.from(new Set(inferred)).sort((a, b) => a.localeCompare(b));
  }, [departments, employees]);

  const localFilteredEmployees = useMemo(() => {
    const normalizedSearch = debouncedSearch.toLowerCase();
    return employees.filter(employee => {
      const matchesSearch =
        employee.name?.toLowerCase().includes(normalizedSearch) ||
        employee.employeeId.toLowerCase().includes(normalizedSearch) ||
        employee.email?.toLowerCase().includes(normalizedSearch) ||
        employee.department?.toLowerCase().includes(normalizedSearch);
      const matchesDepartment = filterDepartment === 'All'
        || employee.department?.toLowerCase() === filterDepartment.toLowerCase();
      return matchesSearch && matchesDepartment;
    });
  }, [employees, debouncedSearch, filterDepartment]);

  const localPagedEmployees = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return localFilteredEmployees.slice(start, start + PAGE_SIZE);
  }, [localFilteredEmployees, page]);

  const visibleEmployees = useBackend ? pageEmployees : localPagedEmployees;
  const filteredVisibleEmployees = visibleEmployees;
  const totalCount = useBackend ? totalEmployees : localFilteredEmployees.length;
  const showLoadingState = useBackend && isPageLoading && filteredVisibleEmployees.length === 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, totalCount);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const pageItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const items: Array<number | 'ellipsis'> = [1];
    let start = Math.max(2, page - 1);
    let end = Math.min(totalPages - 1, page + 1);

    if (page <= 3) {
      start = 2;
      end = 4;
    } else if (page >= totalPages - 2) {
      start = totalPages - 3;
      end = totalPages - 1;
    }

    if (start > 2) {
      items.push('ellipsis');
    }

    for (let current = start; current <= end; current += 1) {
      items.push(current);
    }

    if (end < totalPages - 1) {
      items.push('ellipsis');
    }

    items.push(totalPages);
    return items;
  }, [page, totalPages]);

  const commitPageInput = () => {
    const parsed = Number(pageInput);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(page));
      return;
    }
    const nextPage = Math.min(totalPages, Math.max(1, Math.floor(parsed)));
    setPage(nextPage);
    setPageInput(String(nextPage));
  };

  useEffect(() => {
    if (!viewingEmployee) return;
    const updated = filteredVisibleEmployees.find(employee => employee.id === viewingEmployee.id);
    if (updated) {
      setViewingEmployee(updated);
    }
  }, [filteredVisibleEmployees, viewingEmployee?.id]);

  useEffect(() => {
    setCommentText('');
  }, [viewingEmployee?.id]);

  const canViewPersonalDetails = isAdmin(currentUser || null);

  useEffect(() => {
    if (!canViewPersonalDetails && activeTab === 'personal') {
      setActiveTab('overview');
    }
  }, [activeTab, canViewPersonalDetails]);

  // Compute assigned asset counts
  const assetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredVisibleEmployees.forEach(emp => {
      counts[emp.id] = assets.filter(a => 
        a.assignedToId === emp.id || 
        a.employeeId === emp.id || 
        a.assignedTo === emp.name
      ).length;
    });
    return counts;
  }, [filteredVisibleEmployees, assets]);

  // Get assets assigned to an employee
  const getEmployeeAssets = (employee: Employee) => {
    return assets.filter(a => 
      a.assignedToId === employee.id || 
      a.employeeId === employee.id || 
      a.assignedTo === employee.name
    );
  };

  const buildEmployeeCommentEntry = (text: string) => {
    const author = currentUser?.name || 'System';
    return `[${new Date().toISOString()}] ${author}: ${text.trim()}`;
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingEmployee || !commentText.trim()) return;

    const entries = splitEmployeeComments(viewingEmployee.personalInfo?.additionalComments);
    entries.push(buildEmployeeCommentEntry(commentText));
    const updatedComments = entries.join(AUDIT_COMMENT_SEPARATOR);

    const updatedEmployee: Employee = {
      ...viewingEmployee,
      personalInfo: {
        ...(viewingEmployee.personalInfo || {}),
        additionalComments: updatedComments
      }
    };

    try {
      await onUpdate(updatedEmployee);
      setViewingEmployee(updatedEmployee);
      setCommentText('');
    } catch (error) {
      console.error('Error adding employee comment:', error);
    }
  };

  const openNew = () => {
    setEditingEmployee(null);
    setFormData(initialFormData);
    setFullNameInput('');
    setCurrentStep(1);
    setIsModalOpen(true);
    setFormErrors({});
    setEmployeeIdError('');
    setSubmitError('');
  };

  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    
    // Populate form from employee data
    const nameParts = employee.name?.split(' ') || [];
    const personalInfo = employee.personalInfo;
    
    const officialInfo = employee.officialInfo;
    const displayName = `${personalInfo?.firstName || nameParts[0] || ''} ${personalInfo?.lastName || nameParts.slice(1).join(' ') || ''}`.trim();

    setFormData({
      employeeId: employee.employeeId,
      locationId: employee.locationId,
      status: employee.status,
      personalInfo: {
        firstName: personalInfo?.firstName || nameParts[0] || '',
        lastName: personalInfo?.lastName || nameParts.slice(1).join(' ') || '',
        gender: personalInfo?.gender || '',
        mobileNumber: personalInfo?.mobileNumber || '',
        emergencyContactName: personalInfo?.emergencyContactName || '',
        emergencyContactNumber: personalInfo?.emergencyContactNumber || '',
        personalEmail: personalInfo?.personalEmail || '',
        linkedinUrl: personalInfo?.linkedinUrl || '',
        additionalComments: personalInfo?.additionalComments || ''
      },
      officialInfo: {
        department: officialInfo?.division || employee.department || '',
        biometricId: officialInfo?.biometricId || '',
        rfidSerial: officialInfo?.rfidSerial || '',
        agreementSigned: officialInfo?.agreementSigned || false,
        startDate: officialInfo?.startDate || '',
        officialDob: officialInfo?.officialDob || '',
        officialEmail: officialInfo?.officialEmail || employee.email || ''
      }
    });
    setFullNameInput(displayName);
    
    setCurrentStep(1);
    setIsModalOpen(true);
    setFormErrors({});
    setEmployeeIdError('');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setFormData(initialFormData);
    setFullNameInput('');
    setCurrentStep(1);
    setFormErrors({});
    setEmployeeIdError('');
    setSubmitError('');
  };

  const showDialog = (type: DialogType, title: string, message: string, onConfirm?: () => void) => {
    setDialogState({
      isOpen: true,
      type,
      title,
      message,
      onConfirm: onConfirm || (() => setDialogState(prev => ({ ...prev, isOpen: false })))
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmployeeIdError('');
    setSubmitError('');
    setFormErrors({});
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }
    if (!validateStep2()) {
      setCurrentStep(2);
      return;
    }
    if (!validateStep3()) {
      setCurrentStep(3);
      return;
    }
    
    try {
      // Create employee object with all data
      const personalInfoData: Omit<EmployeePersonalInfo, 'id'> = {
        firstName: formData.personalInfo.firstName,
        lastName: formData.personalInfo.lastName || undefined,
        gender: formData.personalInfo.gender || undefined,
        mobileNumber: formData.personalInfo.mobileNumber || undefined,
        emergencyContactName: formData.personalInfo.emergencyContactName || undefined,
        emergencyContactNumber: formData.personalInfo.emergencyContactNumber || undefined,
        personalEmail: formData.personalInfo.personalEmail || undefined,
        linkedinUrl: formData.personalInfo.linkedinUrl || undefined,
        additionalComments: formData.personalInfo.additionalComments || undefined
      };

      const officialInfoData: Omit<EmployeeOfficialInfo, 'id'> = {
        division: formData.officialInfo.department || undefined, // Map department to division
        biometricId: formData.officialInfo.biometricId || undefined,
        rfidSerial: formData.officialInfo.rfidSerial || undefined,
        agreementSigned: formData.officialInfo.agreementSigned,
        startDate: formData.officialInfo.startDate || undefined,
        officialDob: formData.officialInfo.officialDob || undefined,
        officialEmail: formData.officialInfo.officialEmail || undefined
      };

      const employeeData: Omit<Employee, 'id'> | Employee = editingEmployee ? {
        ...editingEmployee,
        employeeId: formData.employeeId.toUpperCase(),
        locationId: formData.locationId,
        status: formData.status,
        personalInfo: editingEmployee.personalInfoId && editingEmployee.personalInfo
          ? { ...editingEmployee.personalInfo, ...personalInfoData }
          : personalInfoData,
        officialInfo: editingEmployee.officialInfoId && editingEmployee.officialInfo
          ? { ...editingEmployee.officialInfo, ...officialInfoData }
          : officialInfoData
      } : {
        employeeId: formData.employeeId.toUpperCase(),
        locationId: formData.locationId,
        status: formData.status,
        personalInfo: personalInfoData,
        officialInfo: officialInfoData
      };

      if (editingEmployee) {
        await onUpdate({ ...employeeData, id: editingEmployee.id } as Employee);
      } else {
        await onAdd(employeeData);
      }
      if (useBackend) {
        setRefreshToken(prev => prev + 1);
      }
      closeModal();
    } catch (error: any) {
      console.error('Error submitting employee:', error);
      
      // Parse error message and show in wizard
      let errorMessage = 'Failed to save employee. Please try again.';
      
      if (error.message) {
        errorMessage = error.message;
        
        // Check for specific error types
        if (error.message.includes('Employee ID') || error.message.includes('already exists')) {
          setEmployeeIdError(error.message);
          setCurrentStep(1); // Go back to step 1 to show the error
          setFormErrors({ employeeId: error.message });
        } else if (error.message.includes('Required field') || error.message.includes('missing')) {
          // Extract field name and set appropriate error
          const fieldMatch = error.message.match(/field "(\w+)"/i);
          if (fieldMatch) {
            const fieldName = fieldMatch[1];
            if (fieldName === 'name' || fieldName === 'first_name') {
              setFormErrors({ firstName: 'Full name is required' });
              setCurrentStep(2);
            } else if (fieldName === 'official_email') {
              setFormErrors({ officialEmail: 'Official email is required' });
              setCurrentStep(3);
            } else {
              setSubmitError(errorMessage);
            }
          } else {
            setSubmitError(errorMessage);
          }
        } else if (error.message.includes('Invalid reference') || error.message.includes('location')) {
          setFormErrors({ locationId: 'Invalid location selected. Please choose a valid location.' });
          setCurrentStep(1);
        } else {
          setSubmitError(errorMessage);
        }
      } else {
        setSubmitError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.employeeId || formData.employeeId.trim() === '') {
      errors.employeeId = 'Employee ID is required';
    }

    if (!formData.locationId) {
      errors.locationId = 'Location is required';
    }

    if (!formData.status) {
      errors.status = 'Status is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};

    const fullNameValue = `${formData.personalInfo.firstName || ''} ${formData.personalInfo.lastName || ''}`.trim();
    if (!fullNameValue) {
      errors.firstName = 'Full name is required';
    }

    if (!formData.personalInfo.gender) {
      errors.gender = 'Gender is required';
    }

    if (!formData.personalInfo.mobileNumber || formData.personalInfo.mobileNumber.trim() === '') {
      errors.mobileNumber = 'Mobile number is required';
    }

    if (!formData.personalInfo.personalEmail || formData.personalInfo.personalEmail.trim() === '') {
      errors.personalEmail = 'Personal email is required';
    }

    if (!formData.personalInfo.emergencyContactName || formData.personalInfo.emergencyContactName.trim() === '') {
      errors.emergencyContactName = 'Emergency contact name is required';
    }
    
    if (!formData.personalInfo.emergencyContactNumber || formData.personalInfo.emergencyContactNumber.trim() === '') {
      errors.emergencyContactNumber = 'Emergency contact number is required';
    }
    
    // Email validation
    if (formData.personalInfo.personalEmail && 
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personalInfo.personalEmail)) {
      errors.personalEmail = 'Invalid email format';
    }
    
    // Phone validation (basic format + digit count)
    const countDigits = (value: string) => (value.match(/\d/g) || []).length;
    if (formData.personalInfo.mobileNumber) {
      const mobileDigits = countDigits(formData.personalInfo.mobileNumber);
      if (!/^[\d\s\-\+\(\)]+$/.test(formData.personalInfo.mobileNumber)) {
        errors.mobileNumber = 'Invalid phone number format';
      } else if (mobileDigits < 10 || mobileDigits > 15) {
        errors.mobileNumber = 'Mobile number must be 10 to 15 digits';
      }
    }
    
    if (formData.personalInfo.emergencyContactNumber) {
      const emergencyDigits = countDigits(formData.personalInfo.emergencyContactNumber);
      if (!/^[\d\s\-\+\(\)]+$/.test(formData.personalInfo.emergencyContactNumber)) {
        errors.emergencyContactNumber = 'Invalid phone number format';
      } else if (emergencyDigits < 10 || emergencyDigits > 15) {
        errors.emergencyContactNumber = 'Emergency contact number must be 10 to 15 digits';
      }
    }
    
    // URL validation
    if (formData.personalInfo.linkedinUrl && 
        !/^https?:\/\/.+/.test(formData.personalInfo.linkedinUrl)) {
      errors.linkedinUrl = 'Invalid URL format (must start with http:// or https://)';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.officialInfo.department || formData.officialInfo.department.trim() === '') {
      errors.department = 'Department is required';
    }

    if (!formData.officialInfo.officialEmail || formData.officialInfo.officialEmail.trim() === '') {
      errors.officialEmail = 'Official email is required';
    }
    
    // Email validation
    if (formData.officialInfo.officialEmail && 
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.officialInfo.officialEmail)) {
      errors.officialEmail = 'Invalid email format';
    }

    if (!formData.officialInfo.startDate) {
      errors.startDate = 'Start date is required';
    }

    if (!formData.officialInfo.officialDob) {
      errors.officialDob = 'Official date of birth is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    setSubmitError('');
    if (currentStep === 1) {
      if (validateStep1()) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      if (validateStep2()) {
        setCurrentStep(3);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDelete = async (employee: Employee) => {
    const assignedCount = assetCounts[employee.id] || 0;
    if (assignedCount > 0) {
      showDialog(DialogType.WARNING, 'Cannot Delete Employee', `Cannot delete ${employee.name}. They have ${assignedCount} asset(s) assigned. Please reassign or unassign assets first.`);
      return;
    }

    showDialog(DialogType.DANGER, 'Confirm Deletion', `Are you sure you want to delete ${employee.name}?`, async () => {
      try {
        await onDelete(employee.id);
        if (useBackend) {
          setPageEmployees(prev => prev.filter(item => item.id !== employee.id));
          setTotalEmployees(prev => Math.max(0, prev - 1));
          setRefreshToken(prev => prev + 1);
        }
      } catch (error: any) {
        console.error('Error deleting employee:', error);
        const errorMsg = error.message || 'Failed to delete employee. Please try again.';
        setSubmitError(errorMsg);
        setTimeout(() => setSubmitError(''), 5000);
      }
    });
  };

  // Render Step 1: Basic Information
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-start gap-3 mb-4">
        <div className="p-2 bg-white rounded-lg shadow-sm text-blue-600">
          <UserCircle size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">Basic Employee Information</h3>
          <p className="text-xs text-gray-500 mt-1">Enter the core identification details for this employee.</p>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase block mb-1">Employee ID *</label>
        <input
          required
          disabled={isSubmitting || !!editingEmployee}
          className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity font-mono ${
            formErrors.employeeId || employeeIdError 
              ? 'border-red-300 focus:ring-red-100' 
              : 'border-gray-200 focus:ring-blue-100'
          }`}
          value={formData.employeeId}
          onChange={e => {
            setFormData(prev => ({ ...prev, employeeId: e.target.value.toUpperCase() }));
            if (formErrors.employeeId) setFormErrors(prev => ({ ...prev, employeeId: undefined }));
            if (employeeIdError) setEmployeeIdError('');
          }}
          placeholder="e.g. EMP001"
        />
        {formErrors.employeeId && (
          <p className="text-xs text-red-600 mt-1">{formErrors.employeeId}</p>
        )}
        {employeeIdError && !formErrors.employeeId && (
          <p className="text-xs text-red-600 mt-1">{employeeIdError}</p>
        )}
        {editingEmployee && !formErrors.employeeId && !employeeIdError && (
          <p className="text-xs text-gray-500 mt-1">Employee ID cannot be changed after creation</p>
        )}
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase block mb-1">Location *</label>
        <select
          disabled={isSubmitting}
          className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
            formErrors.locationId
              ? 'border-red-300 focus:ring-red-100'
              : 'border-gray-200 focus:ring-blue-100'
          }`}
          value={formData.locationId || ''}
          onChange={e => {
            setFormData(prev => ({ ...prev, locationId: e.target.value || undefined }));
            if (formErrors.locationId) setFormErrors(prev => ({ ...prev, locationId: undefined }));
          }}
        >
          <option value="">Select Location</option>
          {locations.map((loc, index) => (
            <option key={`${loc.id || loc.name || 'location'}-${index}`} value={loc.id}>
              {loc.name} - {loc.city}
            </option>
          ))}
        </select>
        {formErrors.locationId && (
          <p className="text-xs text-red-600 mt-1">{formErrors.locationId}</p>
        )}
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase block mb-1">Status *</label>
        <select
          disabled={isSubmitting}
          className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
            formErrors.status
              ? 'border-red-300 focus:ring-red-100'
              : 'border-gray-200 focus:ring-blue-100'
          }`}
          value={formData.status}
          onChange={e => {
            setFormData(prev => ({ ...prev, status: e.target.value as EmployeeStatus }));
            if (formErrors.status) setFormErrors(prev => ({ ...prev, status: undefined }));
          }}
        >
          {Object.values(EmployeeStatus).map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        {formErrors.status && (
          <p className="text-xs text-red-600 mt-1">{formErrors.status}</p>
        )}
      </div>
    </div>
  );

  // Render Step 2: Personal Information
  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 flex items-start gap-3 mb-4">
        <div className="p-2 bg-white rounded-lg shadow-sm text-purple-600">
          <User size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">Personal Information</h3>
          <p className="text-xs text-gray-500 mt-1">This information is kept confidential and used for HR records and emergency contacts.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Full Name *</label>
          <input
            required
            disabled={isSubmitting}
            className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
              formErrors.firstName 
                ? 'border-red-300 focus:ring-red-100' 
                : 'border-gray-200 focus:ring-blue-100'
            }`}
            value={fullNameInput}
            onChange={e => {
              const rawValue = e.target.value;
              const trimmed = rawValue.trim();
              const parts = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
              const firstName = parts[0] || '';
              const lastName = parts.slice(1).join(' ');
              setFullNameInput(rawValue);
              setFormData(prev => ({
                ...prev,
                personalInfo: { ...prev.personalInfo, firstName, lastName }
              }));
              if (formErrors.firstName) setFormErrors(prev => ({ ...prev, firstName: undefined }));
            }}
            placeholder="e.g. John Doe"
          />
          {formErrors.firstName && (
            <p className="text-xs text-red-600 mt-1">{formErrors.firstName}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Gender *</label>
          <select
            disabled={isSubmitting}
            className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
              formErrors.gender
                ? 'border-red-300 focus:ring-red-100'
                : 'border-gray-200 focus:ring-blue-100'
            }`}
            value={formData.personalInfo.gender || ''}
            onChange={e => {
              setFormData(prev => ({
                ...prev,
                personalInfo: { ...prev.personalInfo, gender: e.target.value || undefined }
              }));
              if (formErrors.gender) setFormErrors(prev => ({ ...prev, gender: undefined }));
            }}
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
          {formErrors.gender && (
            <p className="text-xs text-red-600 mt-1">{formErrors.gender}</p>
          )}
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Mobile Number *</label>
          <input
            type="tel"
            disabled={isSubmitting}
            className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
              formErrors.mobileNumber 
                ? 'border-red-300 focus:ring-red-100' 
                : 'border-gray-200 focus:ring-blue-100'
            }`}
            value={formData.personalInfo.mobileNumber}
            onChange={e => {
              setFormData(prev => ({
                ...prev,
                personalInfo: { ...prev.personalInfo, mobileNumber: e.target.value }
              }));
              if (formErrors.mobileNumber) setFormErrors(prev => ({ ...prev, mobileNumber: undefined }));
            }}
            placeholder="e.g. +1 234 567 8900"
          />
          {formErrors.mobileNumber && (
            <p className="text-xs text-red-600 mt-1">{formErrors.mobileNumber}</p>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase block mb-1">Personal Email *</label>
        <input
          type="email"
          disabled={isSubmitting}
          className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
            formErrors.personalEmail 
              ? 'border-red-300 focus:ring-red-100' 
              : 'border-gray-200 focus:ring-blue-100'
          }`}
          value={formData.personalInfo.personalEmail}
          onChange={e => {
            setFormData(prev => ({
              ...prev,
              personalInfo: { ...prev.personalInfo, personalEmail: e.target.value }
            }));
            if (formErrors.personalEmail) setFormErrors(prev => ({ ...prev, personalEmail: undefined }));
          }}
          placeholder="e.g. john.doe@example.com"
        />
        {formErrors.personalEmail && (
          <p className="text-xs text-red-600 mt-1">{formErrors.personalEmail}</p>
        )}
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Emergency Contact</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Contact Name *</label>
            <input
              disabled={isSubmitting}
              className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
                formErrors.emergencyContactName
                  ? 'border-red-300 focus:ring-red-100'
                  : 'border-gray-200 focus:ring-blue-100'
              }`}
              value={formData.personalInfo.emergencyContactName}
              onChange={e => {
                setFormData(prev => ({
                  ...prev,
                  personalInfo: { ...prev.personalInfo, emergencyContactName: e.target.value }
                }));
                if (formErrors.emergencyContactName) setFormErrors(prev => ({ ...prev, emergencyContactName: undefined }));
              }}
              placeholder="e.g. Jane Doe"
            />
            {formErrors.emergencyContactName && (
              <p className="text-xs text-red-600 mt-1">{formErrors.emergencyContactName}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">Contact Number *</label>
            <input
              type="tel"
              disabled={isSubmitting}
              className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
                formErrors.emergencyContactNumber 
                  ? 'border-red-300 focus:ring-red-100' 
                  : 'border-gray-200 focus:ring-blue-100'
              }`}
              value={formData.personalInfo.emergencyContactNumber}
              onChange={e => {
                setFormData(prev => ({
                  ...prev,
                  personalInfo: { ...prev.personalInfo, emergencyContactNumber: e.target.value }
                }));
                if (formErrors.emergencyContactNumber) setFormErrors(prev => ({ ...prev, emergencyContactNumber: undefined }));
              }}
              placeholder="e.g. +1 234 567 8900"
            />
            {formErrors.emergencyContactNumber && (
              <p className="text-xs text-red-600 mt-1">{formErrors.emergencyContactNumber}</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase block mb-1">LinkedIn URL</label>
        <input
          type="url"
          disabled={isSubmitting}
          className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
            formErrors.linkedinUrl 
              ? 'border-red-300 focus:ring-red-100' 
              : 'border-gray-200 focus:ring-blue-100'
          }`}
          value={formData.personalInfo.linkedinUrl}
          onChange={e => {
            setFormData(prev => ({
              ...prev,
              personalInfo: { ...prev.personalInfo, linkedinUrl: e.target.value }
            }));
            if (formErrors.linkedinUrl) setFormErrors(prev => ({ ...prev, linkedinUrl: undefined }));
          }}
          placeholder="e.g. https://linkedin.com/in/johndoe"
        />
        {formErrors.linkedinUrl && (
          <p className="text-xs text-red-600 mt-1">{formErrors.linkedinUrl}</p>
        )}
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase block mb-1">Additional Comments</label>
        <textarea
          disabled={isSubmitting}
          rows={3}
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity resize-none"
          value={formData.personalInfo.additionalComments}
          onChange={e => setFormData(prev => ({
            ...prev,
            personalInfo: { ...prev.personalInfo, additionalComments: e.target.value }
          }))}
          placeholder="Any additional personal information..."
        />
      </div>
    </div>
  );

  // Render Step 3: Official Information
  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 flex items-start gap-3 mb-4">
        <div className="p-2 bg-white rounded-lg shadow-sm text-green-600">
          <Briefcase size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">Official Information</h3>
          <p className="text-xs text-gray-500 mt-1">Work-related details and official records for this employee.</p>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase block mb-1">Department *</label>
        <select
          disabled={isSubmitting}
          className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
            formErrors.department
              ? 'border-red-300 focus:ring-red-100'
              : 'border-gray-200 focus:ring-blue-100'
          }`}
          value={formData.officialInfo.department || ''}
          onChange={e => {
            setFormData(prev => ({
              ...prev,
              officialInfo: { ...prev.officialInfo, department: e.target.value || undefined }
            }));
            if (formErrors.department) setFormErrors(prev => ({ ...prev, department: undefined }));
          }}
        >
          <option value="">Select Department</option>
          {departments.map((dept, index) => (
            <option key={`${dept.id || dept.name || 'department'}-${index}`} value={dept.name}>
              {dept.name}
            </option>
          ))}
        </select>
        {formErrors.department && (
          <p className="text-xs text-red-600 mt-1">{formErrors.department}</p>
        )}
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase block mb-1">
          Official Email *
        </label>
        <input
          type="email"
          required
          disabled={isSubmitting}
          className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
            formErrors.officialEmail 
              ? 'border-red-300 focus:ring-red-100' 
              : 'border-gray-200 focus:ring-blue-100'
          }`}
          value={formData.officialInfo.officialEmail}
          onChange={e => {
            setFormData(prev => ({
              ...prev,
              officialInfo: { ...prev.officialInfo, officialEmail: e.target.value }
            }));
            if (formErrors.officialEmail) setFormErrors(prev => ({ ...prev, officialEmail: undefined }));
          }}
          placeholder="e.g. john.doe@company.com"
        />
        {formErrors.officialEmail && (
          <p className="text-xs text-red-600 mt-1">{formErrors.officialEmail}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Start Date *</label>
          <input
            type="date"
            disabled={isSubmitting}
            className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
              formErrors.startDate
                ? 'border-red-300 focus:ring-red-100'
                : 'border-gray-200 focus:ring-blue-100'
            }`}
            value={formData.officialInfo.startDate}
            onChange={e => {
              setFormData(prev => ({
                ...prev,
                officialInfo: { ...prev.officialInfo, startDate: e.target.value }
              }));
              if (formErrors.startDate) setFormErrors(prev => ({ ...prev, startDate: undefined }));
            }}
          />
          {formErrors.startDate && (
            <p className="text-xs text-red-600 mt-1">{formErrors.startDate}</p>
          )}
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Official Date of Birth *</label>
          <input
            type="date"
            disabled={isSubmitting}
            className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
              formErrors.officialDob
                ? 'border-red-300 focus:ring-red-100'
                : 'border-gray-200 focus:ring-blue-100'
            }`}
            value={formData.officialInfo.officialDob}
            onChange={e => {
              setFormData(prev => ({
                ...prev,
                officialInfo: { ...prev.officialInfo, officialDob: e.target.value }
              }));
              if (formErrors.officialDob) setFormErrors(prev => ({ ...prev, officialDob: undefined }));
            }}
          />
          <p className="text-xs text-gray-500 mt-1">For official records (may differ from actual DOB)</p>
          {formErrors.officialDob && (
            <p className="text-xs text-red-600 mt-1">{formErrors.officialDob}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">Biometric ID</label>
          <input
            disabled={isSubmitting}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            value={formData.officialInfo.biometricId}
            onChange={e => setFormData(prev => ({
              ...prev,
              officialInfo: { ...prev.officialInfo, biometricId: e.target.value }
            }))}
            placeholder="e.g. BIO123456"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">RFID Serial</label>
          <input
            disabled={isSubmitting}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            value={formData.officialInfo.rfidSerial}
            onChange={e => setFormData(prev => ({
              ...prev,
              officialInfo: { ...prev.officialInfo, rfidSerial: e.target.value }
            }))}
            placeholder="e.g. RFID789012"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <input
          type="checkbox"
          id="agreementSigned"
          disabled={isSubmitting}
          className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
          checked={formData.officialInfo.agreementSigned}
          onChange={e => setFormData(prev => ({
            ...prev,
            officialInfo: { ...prev.officialInfo, agreementSigned: e.target.checked }
          }))}
        />
        <label htmlFor="agreementSigned" className="text-sm text-gray-700 cursor-pointer">
          Employee agreement has been signed
        </label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl w-full md:w-80">
            <Search size={16} className="text-gray-400" />
            <input
              className="w-full bg-transparent focus:outline-none text-sm"
              placeholder="Search by name, employee ID, email, or department"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Department</span>
            <select
              value={filterDepartment}
              onChange={e => {
                setFilterDepartment(e.target.value.trim());
                setPage(1);
              }}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none"
            >
              <option value="All">All</option>
              {departmentOptions.map(department => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            {useBackend && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {isPageLoading && (
                  <>
                    <Loader size={14} className="animate-spin" />
                    <span>Loading employees...</span>
                  </>
                )}
                {!isPageLoading && pageError && <span className="text-red-600">{pageError}</span>}
              </div>
            )}
            {canCreate && (
              <button
                onClick={openNew}
                className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-600 text-white text-sm font-semibold shadow-lg shadow-green-600/20 hover:-translate-y-0.5 hover:bg-green-700 transition-transform overflow-hidden ring-1 ring-white/40 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/35 before:via-white/10 before:to-transparent before:pointer-events-none"
              >
                <UserPlus size={18} />
                Add Employee
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-12 text-xs text-gray-400 px-2">
            <span className="col-span-3">Name</span>
            <span className="col-span-2">Employee ID</span>
            <span className="col-span-2">Department</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-2">Assets</span>
            <span className="col-span-1 text-right">Actions</span>
          </div>

          <AnimatePresence>
            {showLoadingState && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/60"
              >
                <div className="flex items-center justify-center gap-2 text-gray-600">
                  <Loader size={16} className="animate-spin" />
                  <span className="font-medium">Loading employees...</span>
                </div>
              </motion.div>
            )}

            {!showLoadingState && filteredVisibleEmployees.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/60"
              >
                <p className="text-gray-700 font-semibold mb-1">
                  {search || filterDepartment !== 'All' ? 'No matching employees' : 'No employees yet'}
                </p>
                <p className="text-gray-500 text-sm">
                  {search || filterDepartment !== 'All'
                    ? 'Try adjusting your search or filters.'
                    : 'Add your first employee to start managing asset assignments.'}
                </p>
              </motion.div>
            )}

            {filteredVisibleEmployees.map((employee, index) => (
              <motion.div
                key={employee.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.01 }}
                className="grid grid-cols-12 items-center px-3 py-3 rounded-xl hover:bg-white/60 transition-all border border-transparent hover:border-gray-100 hover:shadow-sm"
              >
                <div className="col-span-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-200 flex items-center justify-center text-gray-700 font-semibold">
                      {employee.name?.substring(0, 1) || employee.employeeId.substring(0, 1)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 leading-tight">{employee.name || employee.employeeId}</p>
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-mono text-gray-700">{employee.employeeId}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-700">{employee.department || '—'}</p>
                </div>
                <div className="col-span-2">
                  <span className={statusBadge(employee.status)}>{employee.status}</span>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{assetCounts[employee.id] || 0}</span>
                    <span className="text-xs text-gray-500">assigned</span>
                  </div>
                </div>
                <div className="col-span-1 flex items-center gap-2 justify-end">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setViewingEmployee(employee);
                      setActiveTab('overview');
                    }}
                    className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition-colors"
                    title="View Details"
                  >
                    <Eye size={16} />
                  </motion.button>
                  {canUpdate && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => openEdit(employee)}
                      className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </motion.button>
                  )}
                  {canDelete && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDelete(employee)}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
          <span>
            Showing {pageStart}-{pageEnd} of {totalCount}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              First
            </button>
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Prev
            </button>
            <div className="flex items-center gap-1">
              {pageItems.map((item, index) => {
                if (item === 'ellipsis') {
                  return (
                    <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                      ...
                    </span>
                  );
                }
                const isActive = item === page;
                return (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`px-2.5 py-1.5 rounded-lg border text-sm transition-colors ${
                      isActive
                        ? 'border-gray-300 bg-gray-100 text-gray-900'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Last
            </button>
            <div className="flex items-center gap-2 pl-1">
              <label className="text-xs text-gray-500" htmlFor="employee-page-input">
                Go to
              </label>
              <input
                id="employee-page-input"
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onBlur={commitPageInput}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitPageInput();
                  }
                }}
                className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700"
              />
              <span className="text-xs text-gray-400">/ {totalPages}</span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Add/Edit Wizard Modal */}
      <ModalPortal>
        <AnimatePresence>
          {isModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeModal}
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="fixed inset-0 m-auto z-50 w-full max-w-2xl h-[90vh] overflow-y-auto pointer-events-none flex items-center justify-center p-4"
              >
                <GlassCard className="pointer-events-auto w-full max-w-2xl max-h-[90vh] overflow-y-auto !bg-white/95 shadow-2xl border-white/50 m-4 flex flex-col">
                  <div className="flex justify-between items-center mb-6 shrink-0">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">{editingEmployee ? 'Edit Employee' : 'New Employee'}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${currentStep === 1 ? 'bg-blue-100 text-blue-700' : currentStep > 1 ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}>
                          Step 1: Basic
                        </span>
                        <span className="text-gray-300">/</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${currentStep === 2 ? 'bg-purple-100 text-purple-700' : currentStep > 2 ? 'bg-purple-50 text-purple-600' : 'text-gray-400'}`}>
                          Step 2: Personal
                        </span>
                        <span className="text-gray-300">/</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${currentStep === 3 ? 'bg-green-100 text-green-700' : 'text-gray-400'}`}>
                          Step 3: Official
                        </span>
                      </div>
                    </div>
                    <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                      <X size={20} className="text-gray-500" />
                    </button>
                  </div>

                <div className="flex-1 overflow-y-auto p-1">
                  {/* Show general submission error at top */}
                  {submitError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2"
                    >
                      <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-red-700 font-medium">Error</p>
                        <p className="text-sm text-red-600">{submitError}</p>
                      </div>
                      <button
                        onClick={() => setSubmitError('')}
                        className="text-red-400 hover:text-red-600"
                      >
                        <X size={16} />
                      </button>
                    </motion.div>
                  )}
                  
                  {currentStep === 1 && renderStep1()}
                  {currentStep === 2 && renderStep2()}
                  {currentStep === 3 && renderStep3()}
                </div>

                <div className="pt-6 flex justify-between items-center shrink-0 border-t border-gray-100 mt-4">
                  {currentStep > 1 ? (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <ArrowLeft size={16} /> Back
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  )}

                  {currentStep < 3 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="relative px-6 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg hover:from-emerald-700 hover:to-green-700 transition-all duration-300 shadow-lg shadow-emerald-500/30 flex items-center gap-2 text-sm font-medium overflow-hidden ring-1 ring-white/40 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/35 before:via-white/10 before:to-transparent before:pointer-events-none"
                    >
                      Next <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="relative px-6 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg hover:from-emerald-700 hover:to-green-700 transition-all duration-300 shadow-lg shadow-emerald-500/30 flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ring-1 ring-white/40 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/35 before:via-white/10 before:to-transparent before:pointer-events-none"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader size={16} className="animate-spin" />
                          {editingEmployee ? 'Saving...' : 'Creating...'}
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          {editingEmployee ? 'Save Changes' : 'Create Employee'}
                        </>
                      )}
                    </button>
                  )}
                </div>
                </GlassCard>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </ModalPortal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={dialogState.onConfirm}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
      />

      {/* Employee Detail Modal */}
      <AnimatePresence>
        {viewingEmployee && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setViewingEmployee(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative max-h-[90vh] overflow-hidden flex flex-col"
            >
              <button 
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 z-10" 
                onClick={() => setViewingEmployee(null)}
              >
                <X size={18} />
              </button>

              {/* Header */}
              <div className="p-6 border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-200 flex items-center justify-center text-gray-700 text-2xl font-bold">
                    {viewingEmployee.name?.substring(0, 1) || viewingEmployee.employeeId.substring(0, 1)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900">
                      {viewingEmployee.name || `${viewingEmployee.personalInfo?.firstName || ''} ${viewingEmployee.personalInfo?.lastName || ''}`.trim() || viewingEmployee.employeeId}
                    </h3>
                    <p className="text-sm font-mono text-gray-600">ID: {viewingEmployee.employeeId}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={statusBadge(viewingEmployee.status)}>{viewingEmployee.status}</span>
                    <button
                      onClick={() => {
                        setViewingEmployee(null);
                        openEdit(viewingEmployee);
                      }}
                      className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 shrink-0">
                <div className="flex gap-1 px-6">
                  {(
                    canViewPersonalDetails
                      ? (['overview', 'personal', 'official', 'assets'] as const)
                      : (['overview', 'official', 'assets'] as const)
                  ).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                        activeTab === tab
                          ? 'text-green-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      {activeTab === tab && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <AnimatePresence mode="wait">
                  {activeTab === 'overview' && (
                    <motion.div
                      key="overview"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        {viewingEmployee.email && (
                          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                            <Mail size={20} className="text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase mb-1">Email</p>
                              <p className="text-sm font-medium text-gray-900">{viewingEmployee.email}</p>
                            </div>
                          </div>
                        )}
                        {viewingEmployee.department && (
                          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                            <Building size={20} className="text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase mb-1">Department</p>
                              <p className="text-sm font-medium text-gray-900">{viewingEmployee.department}</p>
                            </div>
                          </div>
                        )}
                        {viewingEmployee.location && (
                          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                            <MapPin size={20} className="text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase mb-1">Location</p>
                              <p className="text-sm font-medium text-gray-900">{viewingEmployee.location}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                          <Package size={20} className="text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-500 uppercase mb-1">Assigned Assets</p>
                            <p className="text-sm font-medium text-gray-900">{assetCounts[viewingEmployee.id] || 0}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                          <MessageSquare size={16} className="text-gray-400" />
                          <p className="text-xs text-gray-500 uppercase">Comments / Notes</p>
                        </div>
                        <form onSubmit={handleSubmitComment} className="mb-3">
                          <div className="space-y-2">
                            <textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder="Add a note about this employee..."
                              rows={3}
                              className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 outline-none transition-all text-sm resize-none"
                            />
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                disabled={!commentText.trim()}
                                className="relative flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-medium hover:from-emerald-700 hover:to-green-700 transition-all duration-300 shadow-md shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm overflow-hidden ring-1 ring-white/40 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/35 before:via-white/10 before:to-transparent before:pointer-events-none"
                              >
                                <Send size={16} />
                                Add Comment
                              </button>
                            </div>
                          </div>
                        </form>
                        {orderEmployeeComments(viewingEmployee.personalInfo?.additionalComments).length > 0 ? (
                          <div className="space-y-3">
                            {orderEmployeeComments(viewingEmployee.personalInfo?.additionalComments).map((entry, index) => {
                              const parsed = parseEmployeeCommentEntry(entry);
                              const timeLabel = formatCommentTime(parsed.timestamp);
                              const avatar = parsed.author?.charAt(0)?.toUpperCase() || 'N';
                              return (
                                <div key={`employee-comment-${viewingEmployee.id}-${index}`} className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900">
                                  <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold bg-gradient-to-br from-emerald-500 to-green-600 text-white">
                                        {avatar}
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-gray-900">{parsed.author}</p>
                                        {timeLabel && (
                                          <p className="text-xs text-gray-500">{timeLabel}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{parsed.message}</p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-white">
                            <MessageSquare size={28} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No comments yet</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {canViewPersonalDetails && activeTab === 'personal' && (
                    <motion.div
                      key="personal"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      {viewingEmployee.personalInfo ? (
                        <div className="grid grid-cols-2 gap-4">
                          {viewingEmployee.personalInfo.firstName && (
                            <div className="p-4 bg-gray-50 rounded-xl">
                              <p className="text-xs text-gray-500 uppercase mb-1">First Name</p>
                              <p className="text-sm font-medium text-gray-900">{viewingEmployee.personalInfo.firstName}</p>
                            </div>
                          )}
                          {viewingEmployee.personalInfo.lastName && (
                            <div className="p-4 bg-gray-50 rounded-xl">
                              <p className="text-xs text-gray-500 uppercase mb-1">Last Name</p>
                              <p className="text-sm font-medium text-gray-900">{viewingEmployee.personalInfo.lastName}</p>
                            </div>
                          )}
                          {viewingEmployee.personalInfo.gender && (
                            <div className="p-4 bg-gray-50 rounded-xl">
                              <p className="text-xs text-gray-500 uppercase mb-1">Gender</p>
                              <p className="text-sm font-medium text-gray-900">{viewingEmployee.personalInfo.gender}</p>
                            </div>
                          )}
                          {viewingEmployee.personalInfo.mobileNumber && (
                            <div className="p-4 bg-gray-50 rounded-xl">
                              <p className="text-xs text-gray-500 uppercase mb-1">Mobile Number</p>
                              <p className="text-sm font-medium text-gray-900">{viewingEmployee.personalInfo.mobileNumber}</p>
                            </div>
                          )}
                          {viewingEmployee.personalInfo.personalEmail && (
                            <div className="p-4 bg-gray-50 rounded-xl">
                              <p className="text-xs text-gray-500 uppercase mb-1">Personal Email</p>
                              <p className="text-sm font-medium text-gray-900">{viewingEmployee.personalInfo.personalEmail}</p>
                            </div>
                          )}
                          {viewingEmployee.personalInfo.emergencyContactName && (
                            <div className="p-4 bg-gray-50 rounded-xl">
                              <p className="text-xs text-gray-500 uppercase mb-1">Emergency Contact</p>
                              <p className="text-sm font-medium text-gray-900">{viewingEmployee.personalInfo.emergencyContactName}</p>
                              {viewingEmployee.personalInfo.emergencyContactNumber && (
                                <p className="text-xs text-gray-600 mt-1">{viewingEmployee.personalInfo.emergencyContactNumber}</p>
                              )}
                            </div>
                          )}
                          {viewingEmployee.personalInfo.linkedinUrl && (
                            <div className="p-4 bg-gray-50 rounded-xl">
                              <p className="text-xs text-gray-500 uppercase mb-1">LinkedIn</p>
                              <a href={viewingEmployee.personalInfo.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-600 hover:underline">
                                {viewingEmployee.personalInfo.linkedinUrl}
                              </a>
                            </div>
                          )}
                          <div className="col-span-2 p-4 bg-gray-50 rounded-xl">
                            <div className="flex items-center gap-2 mb-3">
                              <MessageSquare size={16} className="text-gray-400" />
                              <p className="text-xs text-gray-500 uppercase">Additional Comments</p>
                            </div>
                            <form onSubmit={handleSubmitComment} className="mb-3">
                              <div className="space-y-2">
                                <textarea
                                  value={commentText}
                                  onChange={(e) => setCommentText(e.target.value)}
                                  placeholder="Add a note about this employee..."
                                  rows={3}
                                  className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 outline-none transition-all text-sm resize-none"
                                />
                                <div className="flex justify-end">
                                  <button
                                    type="submit"
                                    disabled={!commentText.trim()}
                                    className="relative flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-medium hover:from-emerald-700 hover:to-green-700 transition-all duration-300 shadow-md shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm overflow-hidden ring-1 ring-white/40 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/35 before:via-white/10 before:to-transparent before:pointer-events-none"
                                  >
                                    <Send size={16} />
                                    Add Comment
                                  </button>
                                </div>
                              </div>
                            </form>
                            {orderEmployeeComments(viewingEmployee.personalInfo.additionalComments).length > 0 ? (
                              <div className="space-y-3">
                                {orderEmployeeComments(viewingEmployee.personalInfo.additionalComments).map((entry, index) => {
                                  const parsed = parseEmployeeCommentEntry(entry);
                                  const timeLabel = formatCommentTime(parsed.timestamp);
                                  const avatar = parsed.author?.charAt(0)?.toUpperCase() || 'N';
                                  return (
                                    <div key={`employee-comment-detail-${viewingEmployee.id}-${index}`} className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900">
                                      <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-2">
                                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold bg-gradient-to-br from-emerald-500 to-green-600 text-white">
                                            {avatar}
                                          </div>
                                          <div>
                                            <p className="text-sm font-semibold text-gray-900">{parsed.author}</p>
                                            {timeLabel && (
                                              <p className="text-xs text-gray-500">{timeLabel}</p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{parsed.message}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-white">
                                <MessageSquare size={28} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No comments yet</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-400">
                          <User size={40} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No personal information available</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'official' && (
                    <motion.div
                      key="official"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      {viewingEmployee.officialInfo ? (
                        <div className="grid grid-cols-2 gap-4">
                          {viewingEmployee.officialInfo.division && (
                            <div className="p-4 bg-gray-50 rounded-xl">
                              <p className="text-xs text-gray-500 uppercase mb-1">Department</p>
                              <p className="text-sm font-medium text-gray-900">{viewingEmployee.officialInfo.division}</p>
                            </div>
                          )}
                          {viewingEmployee.officialInfo.officialEmail && (
                            <div className="p-4 bg-gray-50 rounded-xl">
                              <p className="text-xs text-gray-500 uppercase mb-1">Official Email</p>
                              <p className="text-sm font-medium text-gray-900">{viewingEmployee.officialInfo.officialEmail}</p>
                            </div>
                          )}
                          {viewingEmployee.officialInfo.startDate && (
                            <div className="p-4 bg-gray-50 rounded-xl">
                              <p className="text-xs text-gray-500 uppercase mb-1">Start Date</p>
                              <p className="text-sm font-medium text-gray-900">{new Date(viewingEmployee.officialInfo.startDate).toLocaleDateString()}</p>
                            </div>
                          )}
                          {viewingEmployee.officialInfo.officialDob && (
                            <div className="p-4 bg-gray-50 rounded-xl">
                              <p className="text-xs text-gray-500 uppercase mb-1">Official Date of Birth</p>
                              <p className="text-sm font-medium text-gray-900">{new Date(viewingEmployee.officialInfo.officialDob).toLocaleDateString()}</p>
                            </div>
                          )}
                          {viewingEmployee.officialInfo.biometricId && (
                            <div className="p-4 bg-gray-50 rounded-xl">
                              <p className="text-xs text-gray-500 uppercase mb-1">Biometric ID</p>
                              <p className="text-sm font-medium text-gray-900 font-mono">{viewingEmployee.officialInfo.biometricId}</p>
                            </div>
                          )}
                          {viewingEmployee.officialInfo.rfidSerial && (
                            <div className="p-4 bg-gray-50 rounded-xl">
                              <p className="text-xs text-gray-500 uppercase mb-1">RFID Serial</p>
                              <p className="text-sm font-medium text-gray-900 font-mono">{viewingEmployee.officialInfo.rfidSerial}</p>
                            </div>
                          )}
                          <div className="p-4 bg-gray-50 rounded-xl">
                            <p className="text-xs text-gray-500 uppercase mb-1">Agreement Signed</p>
                            <div className="flex items-center gap-2">
                              {viewingEmployee.officialInfo.agreementSigned ? (
                                <CheckCircle size={20} className="text-green-600" />
                              ) : (
                                <X size={20} className="text-red-600" />
                              )}
                              <p className="text-sm font-medium text-gray-900">
                                {viewingEmployee.officialInfo.agreementSigned ? 'Yes' : 'No'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-400">
                          <Briefcase size={40} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No official information available</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'assets' && (
                    <motion.div
                      key="assets"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-3"
                    >
                      {getEmployeeAssets(viewingEmployee).length > 0 ? (
                        getEmployeeAssets(viewingEmployee).map((asset) => (
                          <motion.div
                            key={asset.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h5 className="font-semibold text-gray-900 mb-2">{asset.name}</h5>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <span className="text-xs text-gray-500">Type:</span>
                                    <span>{asset.type}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <span className="text-xs text-gray-500">Status:</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      asset.status === 'Shared Resource' ? 'bg-blue-100 text-blue-800' :
                                      asset.status === 'Available' ? 'bg-green-100 text-green-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {asset.status}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <span className="text-xs text-gray-500">Serial:</span>
                                    <span className="font-mono text-xs">{asset.serialNumber}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <span className="text-xs text-gray-500">Location:</span>
                                    <span>{asset.location}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl bg-gray-50">
                          <Package size={40} className="mx-auto text-gray-300 mb-2" />
                          <p className="text-gray-600 font-medium">No assets assigned</p>
                          <p className="text-sm text-gray-500">This employee has no assets currently assigned to them</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmployeeManagement;
