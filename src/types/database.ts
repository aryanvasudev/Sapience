
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ai_calls": {
                  Row: {
                    "byok": boolean,"created_at": string,"duration_ms": number | null,"error_code": string | null,"fallback_from": string | null,"id": string,"input_tokens": number | null,"kind": string,"lesson_id": string | null,"model": string,"ok": boolean,"output_tokens": number | null,"provider": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "byok"?: boolean,"created_at"?: string,"duration_ms"?: number | null,"error_code"?: string | null,"fallback_from"?: string | null,"id"?: string,"input_tokens"?: number | null,"kind": string,"lesson_id"?: string | null,"model": string,"ok": boolean,"output_tokens"?: number | null,"provider": string,"user_id"?: string | null
                  }
                  Update: {
                    "byok"?: boolean,"created_at"?: string,"duration_ms"?: number | null,"error_code"?: string | null,"fallback_from"?: string | null,"id"?: string,"input_tokens"?: number | null,"kind"?: string,"lesson_id"?: string | null,"model"?: string,"ok"?: boolean,"output_tokens"?: number | null,"provider"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_calls_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"concepts": {
                  Row: {
                    "created_at": string,"explanation_markdown": string | null,"id": string,"output_language": string | null,"question_id": string | null,"source": string,"source_seconds": number | null,"title": string,"updated_at": string,"user_id": string,"youtube_video_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"explanation_markdown"?: string | null,"id"?: string,"output_language"?: string | null,"question_id"?: string | null,"source"?: string,"source_seconds"?: number | null,"title": string,"updated_at"?: string,"user_id": string,"youtube_video_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"explanation_markdown"?: string | null,"id"?: string,"output_language"?: string | null,"question_id"?: string | null,"source"?: string,"source_seconds"?: number | null,"title"?: string,"updated_at"?: string,"user_id"?: string,"youtube_video_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "concepts_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"id": string,"title": string | null,"updated_at": string,"user_id": string,"youtube_video_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"title"?: string | null,"updated_at"?: string,"user_id": string,"youtube_video_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"title"?: string | null,"updated_at"?: string,"user_id"?: string,"youtube_video_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"lesson_chapters": {
                  Row: {
                    "end_seconds": number,"formulas": (string)[],"id": string,"key_moments": NonNullable<Json>,"key_terms": (string)[],"lesson_id": string,"notes_markdown": string | null,"position": number,"segments": NonNullable<Json>,"start_seconds": number,"status": string,"summary": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "end_seconds": number,"formulas"?: (string)[],"id"?: string,"key_moments"?: NonNullable<Json>,"key_terms"?: (string)[],"lesson_id": string,"notes_markdown"?: string | null,"position": number,"segments"?: NonNullable<Json>,"start_seconds": number,"status"?: string,"summary"?: string | null,"title": string
                  }
                  Update: {
                    "end_seconds"?: number,"formulas"?: (string)[],"id"?: string,"key_moments"?: NonNullable<Json>,"key_terms"?: (string)[],"lesson_id"?: string,"notes_markdown"?: string | null,"position"?: number,"segments"?: NonNullable<Json>,"start_seconds"?: number,"status"?: string,"summary"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_chapters_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_jobs": {
                  Row: {
                    "attempts": number,"byok_user_id": string | null,"created_at": string,"error_code": string | null,"id": string,"kind": string,"lesson_id": string,"locked_at": string | null,"payload": NonNullable<Json>,"run_after": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"byok_user_id"?: string | null,"created_at"?: string,"error_code"?: string | null,"id"?: string,"kind": string,"lesson_id": string,"locked_at"?: string | null,"payload"?: NonNullable<Json>,"run_after"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"byok_user_id"?: string | null,"created_at"?: string,"error_code"?: string | null,"id"?: string,"kind"?: string,"lesson_id"?: string,"locked_at"?: string | null,"payload"?: NonNullable<Json>,"run_after"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_jobs_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_progress": {
                  Row: {
                    "last_position_seconds": number,"output_language": string,"started_at": string,"updated_at": string,"user_id": string,"youtube_video_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_position_seconds"?: number,"output_language": string,"started_at"?: string,"updated_at"?: string,"user_id": string,"youtube_video_id": string
                  }
                  Update: {
                    "last_position_seconds"?: number,"output_language"?: string,"started_at"?: string,"updated_at"?: string,"user_id"?: string,"youtube_video_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_progress_youtube_video_id_fkey"
      columns: ["youtube_video_id"]
isOneToOne: false
      referencedRelation: "videos"
      referencedColumns: ["youtube_video_id"]
    }
                  ]
                },"lessons": {
                  Row: {
                    "chapters_failed": number,"chapters_ready": number,"chapters_total": number,"created_at": string,"created_by": string | null,"error_code": string | null,"generation_ms": number,"id": string,"input_tokens": number,"last_nudged_at": string | null,"model": string | null,"output_language": string,"output_tokens": number,"overview": string | null,"prompt_version": string,"provider": string | null,"source": string,"spoken_language": string | null,"status": string,"updated_at": string,"youtube_video_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chapters_failed"?: number,"chapters_ready"?: number,"chapters_total"?: number,"created_at"?: string,"created_by"?: string | null,"error_code"?: string | null,"generation_ms"?: number,"id"?: string,"input_tokens"?: number,"last_nudged_at"?: string | null,"model"?: string | null,"output_language": string,"output_tokens"?: number,"overview"?: string | null,"prompt_version": string,"provider"?: string | null,"source"?: string,"spoken_language"?: string | null,"status"?: string,"updated_at"?: string,"youtube_video_id": string
                  }
                  Update: {
                    "chapters_failed"?: number,"chapters_ready"?: number,"chapters_total"?: number,"created_at"?: string,"created_by"?: string | null,"error_code"?: string | null,"generation_ms"?: number,"id"?: string,"input_tokens"?: number,"last_nudged_at"?: string | null,"model"?: string | null,"output_language"?: string,"output_tokens"?: number,"overview"?: string | null,"prompt_version"?: string,"provider"?: string | null,"source"?: string,"spoken_language"?: string | null,"status"?: string,"updated_at"?: string,"youtube_video_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_youtube_video_id_fkey"
      columns: ["youtube_video_id"]
isOneToOne: false
      referencedRelation: "videos"
      referencedColumns: ["youtube_video_id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "conversation_id": string,"created_at": string,"id": string,"metadata": NonNullable<Json>,"parts": NonNullable<Json>,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"parts": NonNullable<Json>,"role": string,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"parts"?: NonNullable<Json>,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "content": string | null,"created_at": string,"id": string,"kind": string,"seconds": number | null,"updated_at": string,"user_id": string,"youtube_video_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"seconds"?: number | null,"updated_at"?: string,"user_id": string,"youtube_video_id": string
                  }
                  Update: {
                    "content"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"seconds"?: number | null,"updated_at"?: string,"user_id"?: string,"youtube_video_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"onboarded_at": string | null,"preferences": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"onboarded_at"?: string | null,"preferences"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"onboarded_at"?: string | null,"preferences"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"question_attempts": {
                  Row: {
                    "created_at": string,"id": string,"is_correct": boolean,"question_id": string,"selected_index": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_correct": boolean,"question_id": string,"selected_index": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_correct"?: boolean,"question_id"?: string,"selected_index"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_attempts_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "at_seconds": number | null,"chapter_id": string | null,"concept": string,"correct_index": number,"created_at": string,"explanation": string,"id": string,"lesson_id": string | null,"misconception": string | null,"options": NonNullable<Json>,"owner_user_id": string | null,"prompt": string,"source": string,"youtube_video_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "at_seconds"?: number | null,"chapter_id"?: string | null,"concept": string,"correct_index": number,"created_at"?: string,"explanation": string,"id"?: string,"lesson_id"?: string | null,"misconception"?: string | null,"options": NonNullable<Json>,"owner_user_id"?: string | null,"prompt": string,"source": string,"youtube_video_id"?: string | null
                  }
                  Update: {
                    "at_seconds"?: number | null,"chapter_id"?: string | null,"concept"?: string,"correct_index"?: number,"created_at"?: string,"explanation"?: string,"id"?: string,"lesson_id"?: string | null,"misconception"?: string | null,"options"?: NonNullable<Json>,"owner_user_id"?: string | null,"prompt"?: string,"source"?: string,"youtube_video_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_chapter_id_fkey"
      columns: ["chapter_id"]
isOneToOne: false
      referencedRelation: "lesson_chapters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"revision_items": {
                  Row: {
                    "card": NonNullable<Json>,"concept_id": string,"created_at": string,"due_at": string,"id": string,"lapses": number,"last_rating": string | null,"last_reviewed_at": string | null,"reps": number,"state": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card": NonNullable<Json>,"concept_id": string,"created_at"?: string,"due_at": string,"id"?: string,"lapses"?: number,"last_rating"?: string | null,"last_reviewed_at"?: string | null,"reps"?: number,"state"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "card"?: NonNullable<Json>,"concept_id"?: string,"created_at"?: string,"due_at"?: string,"id"?: string,"lapses"?: number,"last_rating"?: string | null,"last_reviewed_at"?: string | null,"reps"?: number,"state"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "revision_items_concept_id_fkey"
      columns: ["concept_id"]
isOneToOne: true
      referencedRelation: "concepts"
      referencedColumns: ["id"]
    }
                  ]
                },"revision_reviews": {
                  Row: {
                    "id": string,"log": Json | null,"next_due_at": string | null,"prev_due_at": string | null,"rating": string,"reviewed_at": string,"revision_item_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"log"?: Json | null,"next_due_at"?: string | null,"prev_due_at"?: string | null,"rating": string,"reviewed_at"?: string,"revision_item_id": string,"user_id": string
                  }
                  Update: {
                    "id"?: string,"log"?: Json | null,"next_due_at"?: string | null,"prev_due_at"?: string | null,"rating"?: string,"reviewed_at"?: string,"revision_item_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "revision_reviews_revision_item_id_fkey"
      columns: ["revision_item_id"]
isOneToOne: false
      referencedRelation: "revision_items"
      referencedColumns: ["id"]
    }
                  ]
                },"usage_daily": {
                  Row: {
                    "ai_requests": number,"day": string,"lessons_created": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_requests"?: number,"day": string,"lessons_created"?: number,"user_id": string
                  }
                  Update: {
                    "ai_requests"?: number,"day"?: string,"lessons_created"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_api_keys": {
                  Row: {
                    "ciphertext": string,"created_at": string,"iv": string,"last4": string,"provider": string,"updated_at": string,"user_id": string,"validated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ciphertext": string,"created_at"?: string,"iv": string,"last4": string,"provider": string,"updated_at"?: string,"user_id": string,"validated_at"?: string | null
                  }
                  Update: {
                    "ciphertext"?: string,"created_at"?: string,"iv"?: string,"last4"?: string,"provider"?: string,"updated_at"?: string,"user_id"?: string,"validated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"videos": {
                  Row: {
                    "channel_title": string | null,"checked_at": string,"duration_seconds": number,"embeddable": boolean | null,"privacy_status": string | null,"thumbnail_url": string | null,"title": string,"youtube_video_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_title"?: string | null,"checked_at"?: string,"duration_seconds": number,"embeddable"?: boolean | null,"privacy_status"?: string | null,"thumbnail_url"?: string | null,"title": string,"youtube_video_id": string
                  }
                  Update: {
                    "channel_title"?: string | null,"checked_at"?: string,"duration_seconds"?: number,"embeddable"?: boolean | null,"privacy_status"?: string | null,"thumbnail_url"?: string | null,"title"?: string,"youtube_video_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "claim_lesson_job":
{ Args: { "p_job_id": string,"p_max_running": number }; Returns: {
              "attempts": number,
"byok_user_id": string | null,
"created_at": string,
"error_code": string | null,
"id": string,
"kind": string,
"lesson_id": string,
"locked_at": string | null,
"payload": NonNullable<Json>,
"run_after": string,
"status": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "lesson_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"complete_lesson_job":
{ Args: { "p_generation_ms": number,"p_input_tokens": number,"p_job_id": string,"p_model": string,"p_output_tokens": number,"p_provider": string }; Returns: undefined
                           },
"consume_quota":
{ Args: { "p_kind": string,"p_limit": number,"p_user_id": string }; Returns: boolean
                           },
"create_lesson":
{ Args: { "p_created_by": string,"p_job_kind": string,"p_job_payload": Json,"p_output_language": string,"p_prompt_version": string,"p_source": string,"p_youtube_video_id": string }; Returns: {
              "created": boolean,"job_id": string,"lesson_id": string
            }[]
                           },
"dispatchable_jobs":
{ Args: { "p_lesson_id"?: string,"p_max_running": number }; Returns: string[]
                           },
"fail_lesson_job":
{ Args: { "p_error_code": string,"p_job_id": string,"p_retry_delay_seconds": number }; Returns: string
                           },
"global_lessons_today":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"mark_chapters_failed":
{ Args: { "p_lesson_id": string,"p_positions": (number)[] }; Returns: undefined
                           },
"refresh_lesson_counters":
{ Args: { "p_lesson_id": string }; Returns: undefined
                           },
"requeue_lesson_job":
{ Args: { "p_delay_seconds": number,"p_job_id": string }; Returns: undefined
                           },
"restart_lesson":
{ Args: { "p_job_kind": string,"p_job_payload": Json,"p_lesson_id": string,"p_min_age_seconds": number,"p_source": string }; Returns: string
                           },
"retry_chapters":
{ Args: { "p_lesson_id": string,"p_position": number }; Returns: string[]
                           },
"save_chapter_batch":
{ Args: { "p_details": Json,"p_lesson_id": string }; Returns: undefined
                           },
"save_full_lesson":
{ Args: { "p_lesson": Json,"p_lesson_id": string }; Returns: undefined
                           },
"save_outline":
{ Args: { "p_batches": Json,"p_lesson_id": string,"p_outline": Json }; Returns: string[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
