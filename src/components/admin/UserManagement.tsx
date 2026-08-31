import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Key, Edit, Trash2, Mail, Loader2, Search, X, Save, Eye, EyeOff } from 'lucide-react';

const UserManagement: React.FC = () => {
    const { toast } = useToast();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [formParams, setFormParams] = useState({
        name: '',
        email: '',
        password: '',
        role: 'EMPLOYEE',
    });

    // Edit user modal
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', role: '' });
    const [savingEdit, setSavingEdit] = useState(false);

    // Change password modal
    const [passwordUser, setPasswordUser] = useState<any | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('employees').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setUsers(data || []);
        } catch (error: any) {
            toast({ title: '❌ Erro ao buscar', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formParams.name || !formParams.password) {
            toast({ title: '⚠️ Preencha Nome e Senha', variant: 'destructive' });
            return;
        }
        try {
            setLoading(true);
            const payload = {
                name: formParams.name,
                email: formParams.email || null,
                role: formParams.role === 'ADMIN' ? 'Administrador' : formParams.role === 'CLIENT' ? 'Cliente' : 'Funcionário',
                password: formParams.password,
                active: true
            };
            const { error } = await supabase.from('employees').insert([payload]);
            if (error) throw error;
            toast({ title: '✅ Usuário criado com sucesso!' });
            setShowForm(false);
            setFormParams({ name: '', email: '', password: '', role: 'EMPLOYEE' });
            fetchUsers();
        } catch (error: any) {
            toast({ title: '❌ Erro ao salvar', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const openEdit = (u: any) => {
        setEditingUser(u);
        setEditForm({
            name: u.name || '',
            email: u.email || '',
            role: u.role || 'Funcionário',
        });
    };

    const handleEdit = async () => {
        if (!editForm.name.trim()) {
            toast({ title: '⚠️ Nome é obrigatório', variant: 'destructive' });
            return;
        }
        setSavingEdit(true);
        try {
            const { error } = await supabase.from('employees').update({
                name: editForm.name.trim(),
                email: editForm.email.trim() || null,
                role: editForm.role,
            }).eq('id', editingUser.id);
            if (error) throw error;
            toast({ title: '✅ Usuário atualizado!' });
            setEditingUser(null);
            fetchUsers();
        } catch (error: any) {
            toast({ title: '❌ Erro ao atualizar', description: error.message, variant: 'destructive' });
        } finally {
            setSavingEdit(false);
        }
    };

    const openChangePassword = (u: any) => {
        setPasswordUser(u);
        setNewPassword('');
        setShowPassword(false);
    };

    const handleChangePassword = async () => {
        if (!newPassword.trim() || newPassword.length < 4) {
            toast({ title: '⚠️ Senha deve ter pelo menos 4 caracteres', variant: 'destructive' });
            return;
        }
        setSavingPassword(true);
        try {
            const { error } = await supabase.from('employees').update({
                password: newPassword.trim(),
            }).eq('id', passwordUser.id);
            if (error) throw error;
            toast({ title: '✅ Senha alterada com sucesso!', description: `Senha de ${passwordUser.name} foi atualizada.` });
            setPasswordUser(null);
            setNewPassword('');
        } catch (error: any) {
            toast({ title: '❌ Erro ao alterar senha', description: error.message, variant: 'destructive' });
        } finally {
            setSavingPassword(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja remover este usuário?')) return;
        try {
            const { error } = await supabase.from('employees').delete().eq('id', id);
            if (error) throw error;
            toast({ title: '✅ Usuário removido' });
            fetchUsers();
        } catch (error: any) {
            toast({ title: '❌ Erro ao remover', description: error.message, variant: 'destructive' });
        }
    };

    const filteredUsers = users.filter(u =>
        (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-8 space-y-6 overflow-auto h-full bg-[#0f0f0f] text-white">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 flex items-center gap-3">
                        <Users className="w-8 h-8 text-amber-500" />
                        Gestão de Usuários
                    </h1>
                    <p className="text-gray-500 mt-1">Funcionários e Clientes do Sistema</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="text-black px-6 py-3 rounded-2xl font-bold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
                >
                    <Plus className="w-5 h-5" />
                    Novo Usuário
                </button>
            </header>

            <div className="relative max-w-md">
                <Search className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou e-mail..."
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-gray-600"
                />
            </div>

            {showForm && (
                <div className="bg-[#111111] border border-amber-500/20 rounded-3xl p-6 shadow-xl space-y-4">
                    <h3 className="font-bold text-lg text-white">Cadastrar Novo Usuário</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nome Completo *</label>
                            <input
                                value={formParams.name}
                                onChange={e => setFormParams({ ...formParams, name: e.target.value })}
                                className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white"
                                placeholder="Robson Silva"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">E-mail para Login</label>
                            <input
                                value={formParams.email}
                                onChange={e => setFormParams({ ...formParams, email: e.target.value })}
                                className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white"
                                placeholder="robson@sdmoveis.com"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Senha Inicial *</label>
                            <input
                                value={formParams.password}
                                onChange={e => setFormParams({ ...formParams, password: e.target.value })}
                                className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white"
                                type="text"
                                placeholder="Senha segura"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nível de Acesso *</label>
                            <select
                                value={formParams.role}
                                onChange={e => setFormParams({ ...formParams, role: e.target.value })}
                                className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white"
                            >
                                <option value="EMPLOYEE">Funcionário</option>
                                <option value="ADMIN">Administrador</option>
                                <option value="CLIENT">Cliente</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button onClick={handleSave} disabled={loading} className="text-black px-6 py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Usuário'}
                        </button>
                        <button onClick={() => setShowForm(false)} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold transition-colors">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-[#111111] border border-white/10 rounded-3xl shadow-xl overflow-hidden">
                <table className="w-full">
                    <thead className="bg-[#1a1a1a] border-b border-white/10">
                        <tr>
                            <th className="text-left p-6 text-xs font-black text-gray-400 uppercase">Usuário</th>
                            <th className="text-left p-6 text-xs font-black text-gray-400 uppercase">Acesso</th>
                            <th className="text-left p-6 text-xs font-black text-gray-400 uppercase">Data de Cadastro</th>
                            <th className="text-right p-6 text-xs font-black text-gray-400 uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(u => (
                            <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                <td className="p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold border border-amber-500/30">
                                            {u.name?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{u.name}</p>
                                            <p className="text-sm text-gray-500 flex items-center gap-1">
                                                <Mail className="w-3 h-3" /> {u.email || 'Sem e-mail'}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-6">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.role === 'Administrador' ? 'bg-red-900/30 text-red-500 border border-red-500/30' :
                                        u.role === 'Funcionário' ? 'bg-green-900/30 text-green-500 border border-green-500/30' :
                                            'bg-blue-900/30 text-blue-500 border border-blue-500/30'}`}>
                                        {u.role || 'Usuário'}
                                    </span>
                                </td>
                                <td className="p-6 text-sm text-gray-500">
                                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="p-6 text-right">
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => openEdit(u)}
                                            className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-amber-500 hover:bg-amber-900/20 transition-all"
                                            title="Editar Usuário"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => openChangePassword(u)}
                                            className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-900/20 transition-all"
                                            title="Trocar Senha"
                                        >
                                            <Key className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            className="w-9 h-9 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-900/20 transition-all"
                                            title="Remover Usuário"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-gray-400">
                                    {loading ? 'Carregando usuários...' : 'Nenhum usuário encontrado.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#111111] border border-amber-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 text-white">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Edit className="w-5 h-5 text-amber-500" />
                                Editar Usuário
                            </h3>
                            <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nome Completo *</label>
                                <input
                                    value={editForm.name}
                                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                    placeholder="Nome do usuário"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">E-mail</label>
                                <input
                                    value={editForm.email}
                                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                    placeholder="email@sdmoveis.com"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nível de Acesso</label>
                                <select
                                    value={editForm.role}
                                    onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                                    className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                >
                                    <option value="Funcionário">Funcionário</option>
                                    <option value="Administrador">Administrador</option>
                                    <option value="Cliente">Cliente</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setEditingUser(null)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold transition-all">
                                Cancelar
                            </button>
                            <button onClick={handleEdit} disabled={savingEdit} className="flex-1 flex items-center justify-center gap-2 text-black py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
                                <Save className="w-4 h-4" />
                                {savingEdit ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {passwordUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-white">
                    <div className="bg-[#111111] border border-blue-500/30 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Key className="w-5 h-5 text-blue-500" />
                                Trocar Senha
                            </h3>
                            <button onClick={() => setPasswordUser(null)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-sm text-gray-400">
                            Definindo nova senha para <span className="font-bold text-white">{passwordUser.name}</span>
                        </p>

                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nova Senha *</label>
                            <div className="relative">
                                <input
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Digite a nova senha..."
                                    className="w-full p-3 pr-12 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <button
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3.5 text-gray-400 hover:text-white"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Mínimo de 4 caracteres.</p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setPasswordUser(null)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold transition-all">
                                Cancelar
                            </button>
                            <button onClick={handleChangePassword} disabled={savingPassword} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                                <Key className="w-4 h-4" />
                                {savingPassword ? 'Salvando...' : 'Alterar Senha'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
