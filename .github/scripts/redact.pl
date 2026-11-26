# Masks common secret shapes in a stream. Usage: ... | perl -p .github/scripts/redact.pl
s/\b(postgres(?:ql)?:\/\/[^:\s\/]+:)[^@\s]+(@)/$1***$2/gi;
s/\b(sk-[A-Za-z0-9_-]{16,})/sk-***/g;
s/\b(AKIA|ASIA)[A-Z0-9]{16}\b/$1***/g;
s/\b(Bearer\s+)[A-Za-z0-9._~+\/=-]{12,}/$1***/gi;
s/\b((?:[A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY|KEY))\s*[=:]\s*)\S+/$1***/gi;
