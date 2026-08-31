export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts_payable: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          paid: boolean
          paid_at: string | null
          supplier_id: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid?: boolean
          paid_at?: string | null
          supplier_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid?: boolean
          paid_at?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable: {
        Row: {
          amount: number
          category: string | null
          client_id: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          project_id: string | null
          received: boolean
          received_at: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          project_id?: string | null
          received?: boolean
          received_at?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          received?: boolean
          received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      advance_requests: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          id: string
          reason: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          employee_id: string
          id?: string
          reason?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          id?: string
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          payment_method: string | null
          reference_id: string | null
          reference_type: string | null
          type: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description: string
          id?: string
          payment_method?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          payment_method?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Relationships: []
      }
      client_projects: {
        Row: {
          client_id: string
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          material: string | null
          name: string
          project_type: string | null
          signed_at: string | null
          status: string
          updated_at: string
          value: number
          warranty: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          material?: string | null
          name: string
          project_type?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          value?: number
          warranty?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          material?: string | null
          name?: string
          project_type?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
          value?: number
          warranty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          client_id: string | null
          content: string | null
          contract_number: number
          created_at: string
          id: string
          notes: string | null
          project_id: string | null
          signed_at: string | null
          status: string
          title: string
          updated_at: string
          valid_until: string | null
          value: number
        }
        Insert: {
          client_id?: string | null
          content?: string | null
          contract_number?: number
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          signed_at?: string | null
          status?: string
          title: string
          updated_at?: string
          valid_until?: string | null
          value?: number
        }
        Update: {
          client_id?: string | null
          content?: string | null
          contract_number?: number
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          signed_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          valid_until?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_adjustments: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          employee_id: string
          hours: number
          id: string
          reference_date: string
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          employee_id: string
          hours?: number
          id?: string
          reference_date?: string
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          employee_id?: string
          hours?: number
          id?: string
          reference_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          hourly_rate: number
          id: string
          name: string
          phone: string | null
          role: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          hourly_rate?: number
          id?: string
          name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          hourly_rate?: number
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: []
      }
      fuel_logs: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          liters: number
          notes: string | null
          odometer: number | null
          price_per_liter: number
          total_cost: number
          trip_id: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          liters: number
          notes?: string | null
          odometer?: number | null
          price_per_liter?: number
          total_cost?: number
          trip_id?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          liters?: number
          notes?: string | null
          odometer?: number | null
          price_per_liter?: number
          total_cost?: number
          trip_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string | null
          cost_price: number
          created_at: string
          description: string | null
          id: string
          min_stock: number
          name: string
          sell_price: number
          sku: string | null
          stock_quantity: number
          supplier_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          min_stock?: number
          name: string
          sell_price?: number
          sku?: string | null
          stock_quantity?: number
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          min_stock?: number
          name?: string
          sell_price?: number
          sku?: string | null
          stock_quantity?: number
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_costs: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          id: string
          project_id: string
          quantity: number
          unit: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description: string
          id?: string
          project_id: string
          quantity?: number
          unit?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          project_id?: string
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_gallery: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string
          project_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          project_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_gallery_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          paid: boolean
          paid_at: string | null
          project_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          project_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_installments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_production_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          name: string
          project_id: string
          sort_order: number
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          name: string
          project_id: string
          sort_order?: number
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_production_steps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_timeline: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          id: string
          project_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date?: string
          id?: string
          project_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          id?: string
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_timeline_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_check_items: {
        Row: {
          checked: boolean
          checklist_id: string
          created_at: string
          id: string
          label: string
          notes: string | null
          sort_order: number
        }
        Insert: {
          checked?: boolean
          checklist_id: string
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          sort_order?: number
        }
        Update: {
          checked?: boolean
          checklist_id?: string
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_check_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "quality_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_checklists: {
        Row: {
          created_at: string
          id: string
          inspector_name: string | null
          notes: string | null
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspector_name?: string | null
          notes?: string | null
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inspector_name?: string | null
          notes?: string | null
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_checklists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          estimated_date: string | null
          id: string
          notes: string | null
          order_number: number
          priority: string
          project_id: string | null
          status: string
          total_value: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_date?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          priority?: string
          project_id?: string | null
          status?: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_date?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          priority?: string
          project_id?: string | null
          status?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          category: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          category?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          category?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
        }
        Insert: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_inventory: {
        Row: {
          condition: string
          created_at: string
          employee_id: string
          id: string
          name: string
          notes: string | null
          quantity: number
          updated_at: string
        }
        Insert: {
          condition?: string
          created_at?: string
          employee_id: string
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          condition?: string
          created_at?: string
          employee_id?: string
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_inventory_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_checklists: {
        Row: {
          checked: boolean
          checklist_type: string
          created_at: string
          id: string
          label: string
          sort_order: number
          trip_id: string
        }
        Insert: {
          checked?: boolean
          checklist_type?: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          trip_id: string
        }
        Update: {
          checked?: boolean
          checklist_type?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_checklists_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_incidents: {
        Row: {
          created_at: string
          description: string
          employee_id: string
          id: string
          resolved: boolean
          trip_id: string
          type: string
        }
        Insert: {
          created_at?: string
          description: string
          employee_id: string
          id?: string
          resolved?: boolean
          trip_id: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string
          employee_id?: string
          id?: string
          resolved?: boolean
          trip_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_incidents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_incidents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_locations: {
        Row: {
          accuracy: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          speed: number | null
          trip_id: string
        }
        Insert: {
          accuracy?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          speed?: number | null
          trip_id: string
        }
        Update: {
          accuracy?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed?: number | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_locations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_photos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          trip_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_photos_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          description: string | null
          employee_id: string
          ended_at: string | null
          id: string
          montagem_status: string
          started_at: string
          status: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          employee_id: string
          ended_at?: string | null
          id?: string
          montagem_status?: string
          started_at?: string
          status?: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          employee_id?: string
          ended_at?: string | null
          id?: string
          montagem_status?: string
          started_at?: string
          status?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          created_at: string
          id: string
          model: string
          plate: string
          year: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          model: string
          plate: string
          year?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          model?: string
          plate?: string
          year?: number | null
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          contact_name: string | null
          created_at: string
          id: string
          last_message_at: string
          lead_status: string
          phone_number: string
          status: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          lead_status?: string
          phone_number: string
          status?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          lead_status?: string
          phone_number?: string
          status?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          message_type: string
          status: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          direction?: string
          id?: string
          message_type?: string
          status?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          message_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role: "admin" | "client" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "client", "employee"],
    },
  },
} as const
