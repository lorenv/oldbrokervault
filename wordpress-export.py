#!/usr/bin/env python3
"""
WordPress CIM Export Script

This script exports CIM content to a WordPress custom field.
It uses the WordPress REST API to update a 'wpcf-text-dump' custom field
on a specified WordPress post.
"""

import requests
import re
import sys
import json
from urllib.parse import urlparse
from getpass import getpass

def extract_post_id_from_url(wp_url, post_url, auth):
    """
    Extracts the post ID from a WordPress post URL by querying the WordPress REST API.
    
    Args:
        wp_url (str): The base WordPress site URL
        post_url (str): The URL of the post to extract the ID from
        auth (tuple): Username and password for authentication
    
    Returns:
        int: The post ID if found, None otherwise
    """
    # Parse the URL to extract the slug
    path = urlparse(post_url).path
    slug = path.strip('/').split('/')[-1]
    
    if not slug:
        print("Could not extract a valid slug from the URL.")
        return None
    
    # Query the WordPress REST API to get the post by slug
    api_url = f"{wp_url.rstrip('/')}/wp-json/wp/v2/posts?slug={slug}"
    
    try:
        response = requests.get(api_url, auth=auth)
        response.raise_for_status()
        
        posts = response.json()
        if not posts:
            # Try pages if no posts are found
            api_url = f"{wp_url.rstrip('/')}/wp-json/wp/v2/pages?slug={slug}"
            response = requests.get(api_url, auth=auth)
            response.raise_for_status()
            posts = response.json()
            
        if posts:
            return posts[0]['id']
        else:
            print(f"No posts or pages found with slug: {slug}")
            return None
            
    except requests.exceptions.HTTPError as err:
        print(f"HTTP Error: {err}")
        print(f"Response: {response.text}")
        return None
    except requests.exceptions.RequestException as err:
        print(f"Request Error: {err}")
        return None
    except json.JSONDecodeError:
        print(f"Failed to parse API response: {response.text}")
        return None

def update_custom_field(wp_url, post_id, content, auth):
    """
    Updates the 'wpcf-text-dump' custom field for a WordPress post.
    
    Args:
        wp_url (str): The base WordPress site URL
        post_id (int): The ID of the post to update
        content (str): The content to store in the custom field
        auth (tuple): Username and password for authentication
        
    Returns:
        bool: True if successful, False otherwise
    """
    # WordPress REST API endpoint for updating post meta
    api_url = f"{wp_url.rstrip('/')}/wp-json/wp/v2/posts/{post_id}"
    
    # The meta field name for Toolset custom fields is prefixed with 'wpcf-'
    meta_field = 'wpcf-text-dump'
    
    # Prepare the data
    data = {
        'meta': {
            meta_field: content
        }
    }
    
    try:
        response = requests.post(api_url, json=data, auth=auth)
        response.raise_for_status()
        
        print(f"Custom field '{meta_field}' successfully updated for post ID: {post_id}")
        return True
        
    except requests.exceptions.HTTPError as err:
        print(f"HTTP Error: {err}")
        print(f"Response: {response.text}")
        return False
    except requests.exceptions.RequestException as err:
        print(f"Request Error: {err}")
        return False

def main():
    """Main function to run the script interactively."""
    print("WordPress CIM Content Export Tool")
    print("=================================")
    
    # Get the WordPress site URL
    wp_url = input("Enter WordPress site URL (e.g., https://mysite.com): ").strip()
    
    # Validate URL format
    if not wp_url.startswith(('http://', 'https://')):
        wp_url = 'https://' + wp_url
    
    # Get authentication details
    print("\nWordPress API Authentication")
    print("Note: This script uses WordPress Application Passwords")
    print("You'll need to create one in your WordPress profile if you haven't already")
    username = input("Enter WordPress username: ").strip()
    password = getpass("Enter Application Password: ")
    
    # Get the post URL
    post_url = input("\nEnter the full URL of the listing/post where the content should be added: ").strip()
    
    # Try to extract the post ID
    print("\nAttempting to retrieve post ID from URL...")
    post_id = extract_post_id_from_url(wp_url, post_url, (username, password))
    
    if not post_id:
        print("Failed to get post ID. Exiting.")
        sys.exit(1)
    
    print(f"Found post ID: {post_id}")
    
    # Get the content to add
    print("\nEnter the CIM content to add to the WordPress post.")
    print("Type or paste below. Press Ctrl+D (Unix) or Ctrl+Z followed by Enter (Windows) when finished:")
    
    content_lines = []
    try:
        while True:
            line = input()
            content_lines.append(line)
    except EOFError:
        content = '\n'.join(content_lines)
    
    # Update the custom field
    print("\nUpdating custom field...")
    success = update_custom_field(wp_url, post_id, content, (username, password))
    
    if success:
        print("\nSuccess! The content has been added to the WordPress post.")
        print(f"View the post at: {post_url}")
    else:
        print("\nFailed to update the WordPress post. Please check the error messages above.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
        sys.exit(0)