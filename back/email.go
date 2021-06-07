package main

import (
	"bytes"
	"fmt"
	"net/smtp"
	"text/template"
	"time"
)

// EMAIL EMAIL EMAIL EMAIL EMAIL EMAIL EMAIL EMAIL EMAIL EMAIL EMAIL EMAIL EMAIL

var (
	// google says they do 500 email-recipients/day for free
	// sending more than that would be so yikes. I can't imagine being that annoying
	// or maybe I already am :)
	emailServer   string   = "smtp.gmail.com"
	serverAccount string   = "traversetext@gmail.com"
	emailPassword string   = "" // set in main from seperate file for security
	devEmails     []string = []string{"taoroalin@gmail.com"}
)

type Email struct {
	Recipients []string
	Subject    string
	Body       string
	Html       bool
}

var emailTemplate, _ = template.New("email").Parse(`To: {{.Recipients}}
Subject: {{.Subject}}
Content-Type: text/{{if .Html}}html{{else}}plain{{end}}; charset="utf-8"
MIME Version: 1

{{.Body}}`)

var emailVerificationTemplate, _ = template.New("test").Parse(
	`<!DOCTYPE html>
<html>

<head>
  <title>Testing Title</title>
</head>

<body style="color:#000000;">
  <table align="center">
    <tr>
      <td>
        <table align="center" bgcolor="#282A36" role="presentation" border="0" cellpadding="0" cellspacing="0"
          style="color:#F8F8F2; border-radius:8px; padding:60px 100px; margin: 0px 100px 0px 100px;">
          <tr>
            <td align="center">
              <p style="margin: 0; font-size:36px;">Traverse Text</p>
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="margin: 0; font-size:16px;">Verify your email to set up your traversetext.com account</p>
            </td>
          </tr>
          <tr style="">
            <td align="center" style="color:#8BE9FD; font-size:24px;">
              <table>
                <tr>
                  <td style="padding: 8px 12px;margin:12px 0px; background-color:#45495f; border-radius:6px;">
                    <a style="color:#8BE9FD; text-decoration:none;"
                      href="https://traversetext.com:3000/verify-email/{{.EmailVerificationCode}}">Verify</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
					<tr>
						<td align="center" style="padding:10px">
							<p style="margin:0;font-size:12px">tiny text</p>
						</td>
					</tr>
        </table>
      </td>
    </tr>
  </table>
</body>

</html>`)

func (email Email) Send() error {
	buf := new(bytes.Buffer)
	templateError := emailTemplate.Execute(buf, email)
	breakOn(templateError)
	auth := smtp.PlainAuth("Tao", serverAccount, emailPassword, emailServer)
	sendError := smtp.SendMail(emailServer+":587", auth, serverAccount, email.Recipients, buf.Bytes())
	return sendError
}

/*
how email confirmation works.

when account is created, email code is generated.

I guess I need a job to delete unverified accounts every week. delete every account not made in the past week every week. this is less overhead than checking a heap at small intervals to catch accounts at exactly 2 weeks or setting an OS timer per account

the API has an endpoint for verifying emails
*/
func sendEmailConfirmationEmail(account *Account) {
	buf := new(bytes.Buffer)
	templateError := emailVerificationTemplate.Execute(buf, account)
	breakOn(templateError)
	email := Email{
		Recipients: []string{account.UserReadable.Email},
		Subject:    "Verification code: " + fmt.Sprint(account.EmailVerificationCode),
		Body:       buf.String(),
		Html:       true,
	}
	email.Send()
}

func emailDevAboutError(message string) error {
	email := Email{
		Recipients: devEmails,
		Subject:    "Traversetext.com Api Error",
		Body:       message,
	}
	err := email.Send()
	breakOn(err)
	return err
}

const timeBetweenEmails = time.Minute * 30

var lastTimeTaoWasEmailed time.Time = time.Now().Add(-timeBetweenEmails)

func emailDevIfItsAnError(err error) {
	if err != nil {
		if time.Since(lastTimeTaoWasEmailed) > timeBetweenEmails {
			lastTimeTaoWasEmailed = time.Now()
			go emailDevAboutError(fmt.Sprint(err))
		}
		panic(err)
	}
}
