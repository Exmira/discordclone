json.extract! message, :id, :text, :user_id, :touser, :created_at, :updated_at
json.url message_url(message, format: :json)
