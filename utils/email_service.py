import requests
import logging
import os

logger = logging.getLogger(__name__)

def send_email(to_email, subject, body, is_html=True):
    """
    Sends an email by calling the internal Email Microservice.
    """
    email_service_url = os.environ.get('EMAIL_SERVICE_URL')
    api_key = os.environ.get('EMAIL_SERVICE_API_KEY')

    if not email_service_url:
        logger.error("EMAIL_SERVICE_URL not configured")
        return False

    payload = {
        "to": to_email,
        "subject": subject,
        "body": body,
        "isHtml": is_html
    }

    headers = {
        "X-Api-Key": api_key,
        "Content-Type": "application/json"
    }

    try:
        logger.info(f"Sending email request to {email_service_url} for {to_email}")
        response = requests.post(email_service_url, json=payload, headers=headers, timeout=10)
        
        if response.status_code in [200, 202]:
            logger.info(f"Email request accepted by microservice. JobId: {response.json().get('jobId')}")
            return True
        else:
            logger.error(f"Email Microservice returned error: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Failed to connect to Email Microservice: {str(e)}")
        return False
