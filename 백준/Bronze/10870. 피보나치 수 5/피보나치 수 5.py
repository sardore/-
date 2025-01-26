fibo=[0,1]
for _ in range(19):
    fibo.append(fibo[-1]+fibo[-2])
print(fibo[(int(input()))])