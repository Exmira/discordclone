Rails.application.routes.draw do

  # Defines the root path route ("/")
   root "home#index"

   get 'home/faq'

   get 'home/contact'

   get 'home/submissions'
end
